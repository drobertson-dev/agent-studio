import { ref, computed, onUnmounted } from 'vue'
import type { BaseMessageLike, Message } from '@langchain/core/messages'
import { useLangGraphClient } from '~/composables/useLangGraphClient'

// Import from decomposed modules
import { StreamError, MessageTupleManager, toMessageDict } from './errors'
import { unique, findLastIndex } from './utils'
import { getBranchSequence, getBranchView } from './branches'
import { useThreadHistory, useControllableThreadId } from './history'
import type { StreamOptions, SubmitOptions, StreamInterface } from './types'

/**
 * Main stream function that provides real-time communication with LangGraph
 */
export function useStream<
  TValues extends Record<string, unknown> = Record<string, unknown>,
  TOptions extends {
    UpdateType?: unknown
    CustomEventType?: unknown
  } = { UpdateType: unknown; CustomEventType: unknown },
>(
  options: StreamOptions<TValues, TOptions['UpdateType'], TOptions['CustomEventType']>
): StreamInterface<TValues> {
  let { assistantId, messagesKey, onError, onFinish } = options
  messagesKey ??= 'messages'

  const langGraph = useLangGraphClient()

  const [threadId, onThreadId] = useControllableThreadId(options)
  const branch = ref<string>('')
  const isLoading = ref<boolean>(false)
  const streamError = ref<Error | undefined>(undefined)
  const streamValues = ref<TValues | null>(null)
  const messageManager = new MessageTupleManager()
  const isSubmitting = ref<boolean>(false)
  const abortController = ref<AbortController | null>(null)
  const trackStreamModes = ref<string[]>([])
  const subgraphs = true

  const trackStreamMode = (...mode: string[]): void => {
    for (const m of mode) {
      if (!trackStreamModes.value.includes(m)) {
        trackStreamModes.value.push(m)
      }
    }
  }

  const hasUpdateListener = options.onUpdateEvent != null
  const hasCustomListener = options.onCustomEvent != null

  const callbackStreamMode = computed(() => {
    const modes: string[] = []
    if (hasUpdateListener) modes.push('updates')
    if (hasCustomListener) modes.push('custom')
    return modes
  })

  const clearStreamState = (): void => {
    streamError.value = undefined
    streamValues.value = null
  }

  // Thread history
  const history = useThreadHistory(threadId, langGraph, clearStreamState, isSubmitting)

  const getMessages = (value: Record<string, unknown>): Message[] => {
    const maybeMessages = value[messagesKey]
    return Array.isArray(maybeMessages) ? (maybeMessages as Message[]) : []
  }

  const branchData = computed(() => {
    const { rootSequence, paths } = getBranchSequence(history.data.value)
    const { history: flatHistory, branchByCheckpoint } = getBranchView(
      rootSequence,
      paths,
      branch.value
    )
    return {
      rootSequence,
      paths,
      flatHistory,
      branchByCheckpoint,
    }
  })

  const flatHistory = computed(() => branchData.value.flatHistory)
  const threadHead = computed(() => flatHistory.value.at(-1))
  const historyValues = computed<TValues>(() => (threadHead.value?.values ?? {}) as TValues)

  const toError = (value: unknown): Error => {
    if (value instanceof Error) return value
    if (StreamError.isStructuredError(value)) return new StreamError(value)
    if (typeof value === 'string') return new Error(value)
    try {
      return new Error(JSON.stringify(value))
    } catch {
      return new Error('Unknown error')
    }
  }

  const historyError = computed<Error | undefined>(() => {
    const error = threadHead.value?.tasks?.at(-1)?.error
    if (error == null) return undefined
    if (typeof error === 'string') {
      try {
        const parsed = JSON.parse(error) as unknown
        return toError(parsed)
      } catch {
        return new Error(error)
      }
    }
    return toError(error)
  })

  const messageMetadata = computed(() => {
    const alreadyShown = new Set<string>()
    return getMessages(historyValues.value).map((message: Message, idx: number) => {
      const messageId = message.id ?? idx
      const firstSeenIdx = findLastIndex(history.data.value, (state) =>
        getMessages(state.values)
          .map((m: Message, idx: number) => m.id ?? idx)
          .includes(messageId)
      )
      const firstSeen = history.data.value[firstSeenIdx]
      let messageBranch =
        firstSeen && firstSeen.checkpoint
          ? branchData.value.branchByCheckpoint[firstSeen.checkpoint.checkpoint_id]
          : undefined
      if (!messageBranch?.branch?.length) messageBranch = undefined
      // serialize branches
      const optionsShown = messageBranch?.branchOptions?.flat(2).join(',')
      if (optionsShown) {
        if (alreadyShown.has(optionsShown)) messageBranch = undefined
        alreadyShown.add(optionsShown)
      }
      return {
        messageId: messageId.toString(),
        firstSeenState: firstSeen,
        branch: messageBranch?.branch,
        branchOptions: messageBranch?.branchOptions,
      }
    })
  })

  const stop = (): void => {
    if (abortController.value != null) abortController.value.abort()
    abortController.value = null
  }

  onUnmounted(() => {
    stop()
  })

  const submit = async (
    values?: Partial<TValues>,
    submitOptions?: SubmitOptions
  ): Promise<void> => {
    try {
      isLoading.value = true
      streamError.value = undefined
      isSubmitting.value = true
      abortController.value = new AbortController()

      let usableThreadId = threadId instanceof Object ? threadId.value : null
      if (!usableThreadId) {
        const thread = await langGraph.threads.create()
        onThreadId(thread.thread_id)
        usableThreadId = thread.thread_id
      }

      const streamMode = unique([
        ...(submitOptions?.streamMode ?? []),
        ...trackStreamModes.value,
        ...callbackStreamMode.value,
      ])

      const checkpoint = submitOptions?.checkpoint ?? threadHead.value?.checkpoint ?? undefined
      if (checkpoint != null) {
        // @ts-expect-error - LangGraph rejects thread_id on checkpoint payloads.
        delete checkpoint.thread_id
      }

      const run = langGraph.runs.stream(usableThreadId, assistantId, {
        input: values,
        config: submitOptions?.config,
        command: submitOptions?.command,
        interruptBefore: submitOptions?.interruptBefore,
        interruptAfter: submitOptions?.interruptAfter,
        metadata: submitOptions?.metadata,
        multitaskStrategy: submitOptions?.multitaskStrategy,
        onCompletion: submitOptions?.onCompletion,
        onDisconnect: submitOptions?.onDisconnect ?? 'cancel',
        signal: abortController.value?.signal,
        checkpoint,
        streamMode,
        subgraphs,
      })

      // Unbranch things
      const newPath = submitOptions?.checkpoint?.checkpoint_id
        ? branchData.value.branchByCheckpoint[submitOptions?.checkpoint?.checkpoint_id]?.branch
        : undefined
      if (newPath != null) branch.value = newPath ?? ''

      // Assumption: we're setting the initial value
      // Used for instant feedback
      const initialValues = { ...historyValues.value }
      streamValues.value =
        submitOptions?.optimisticValues != null
          ? {
              ...initialValues,
              ...(typeof submitOptions.optimisticValues === 'function'
                ? submitOptions.optimisticValues(initialValues as Record<string, unknown>)
                : submitOptions.optimisticValues),
            }
          : (initialValues as TValues)

      let streamErrorOccurred: StreamError | undefined
      for await (const { event, data } of run) {
        if (event === 'error') {
          if (StreamError.isStructuredError(data)) {
            streamErrorOccurred = new StreamError(data)
          } else {
            streamErrorOccurred = new StreamError({
              message: typeof data === 'string' ? data : 'Stream error',
            })
          }
          break
        }
        if (event === 'updates') options.onUpdateEvent?.(data as TOptions['UpdateType'])
        if (event === 'custom')
          options.onCustomEvent?.(data as TOptions['CustomEventType'], {
            mutate: (
              update: Partial<TValues> | ((prev: TValues) => Partial<TValues> | TValues)
            ) => {
              const prev = streamValues.value
              if (prev == null) return

              streamValues.value = {
                ...prev,
                ...(typeof update === 'function' ? update(prev) : update),
              }
            },
          })
        if (event === 'metadata') options.onMetadataEvent?.(data)
        if (event === 'values') streamValues.value = data as TValues
        if (event === 'messages') {
          const [serialized] = data as [unknown]
          const messageId = messageManager.add(serialized as BaseMessageLike)
          if (!messageId) {
            console.warn('Failed to add message to manager, no message ID found')
            continue
          }

          const currentValues = {
            ...historyValues.value,
            ...(streamValues.value ?? ({} as TValues)),
          } as TValues
          // Assumption: we're concatenating the message
          const messages = getMessages(currentValues).slice()
          const result = messageManager.get(messageId, messages.length)
          const { chunk, index } = result ?? {}
          if (!chunk || index == null) continue

          messages[index] = toMessageDict(chunk)
          streamValues.value = { ...currentValues, [messagesKey]: messages } as TValues
        }
      }

      // TODO: stream created checkpoints to avoid an unnecessary network request
      const result = await history.mutate(usableThreadId)
      streamValues.value = null

      if (streamErrorOccurred != null) throw streamErrorOccurred

      const lastHead = result.at(0)
      if (lastHead) onFinish?.(lastHead)
    } catch (error) {
      if (
        !(error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
      ) {
        const err = error instanceof Error ? error : new Error(String(error))
        console.error(err)
        streamError.value = err
        onError?.(err)
      }
      // On error, try to fetch history so we don't lose messages.
      // Keep streamValues alive as fallback until history lands.
      try {
        const tid = threadId instanceof Object ? threadId.value : null
        if (tid) await history.mutate(tid)
      } catch {
        // best-effort
      }
      streamValues.value = null
    } finally {
      isLoading.value = false
      // Assumption: messages are already handled, we can clear the manager
      messageManager.clear()
      // Keep isSubmitting true until after cleanup so the threadId watcher
      // doesn't fire a competing history fetch.
      isSubmitting.value = false
      abortController.value = null
    }
  }

  // Combine reactive values
  const error = computed(() => streamError.value ?? historyError.value)
  const values = computed<TValues>(() => (streamValues.value ?? historyValues.value) as TValues)
  const interrupt = computed(() => {
    // Don't show the interrupt if the stream is loading
    if (isLoading.value) return undefined
    const interrupts = threadHead.value?.tasks?.at(-1)?.interrupts
    if (interrupts == null || interrupts.length === 0) {
      // check if there's a next task present
      const next = threadHead.value?.next ?? []
      if (!next.length || error.value != null) return undefined
      return { when: 'breakpoint' }
    }
    // Return only the current interrupt
    return interrupts.at(-1)
  })

  const messages = computed(() => {
    trackStreamMode('messages-tuple', 'values')
    return getMessages(values.value)
  })

  const getMessagesMetadata = (message: Message, index?: number) => {
    trackStreamMode('messages-tuple', 'values')
    return messageMetadata.value?.find((m) => m.messageId === (message.id ?? index))
  }
  // Return the stream interface
  return {
    // Properties
    get values() {
      trackStreamMode('values')
      return values.value
    },
    assistantId,
    error,
    isLoading,
    branch,
    history: flatHistory,
    experimental_branchTree: computed(() => branchData.value.rootSequence),
    get interrupt() {
      return interrupt.value
    },
    get messages() {
      return messages.value
    },
    // Methods
    stop,
    submit,
    setBranch: (newBranch: string) => {
      branch.value = newBranch
    },
    onThreadId,
    getMessagesMetadata,
  }
}

// Re-export types and utilities from modules
export * from './types'
export * from './errors'
export * from './utils'
export * from './branches'
export * from './history'
