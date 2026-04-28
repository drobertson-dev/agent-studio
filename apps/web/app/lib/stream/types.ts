import type { ComputedRef, Ref } from 'vue'
import type { HistoryState, SequenceNode } from './branches'
import type { Message } from '@langchain/core/messages'

/**
 * @description Options for the stream functionality
 */
export interface StreamOptions<
  TValues = Record<string, unknown>,
  TUpdateType = unknown,
  TCustomEventType = unknown,
> {
  assistantId: string
  threadId?: string | null
  messagesKey?: string
  onError?: (error: Error) => void
  onFinish?: (state: HistoryState) => void
  onUpdateEvent?: (data: TUpdateType) => void
  onCustomEvent?: (
    data: TCustomEventType,
    options: {
      mutate: (updater: ((prev: TValues) => Partial<TValues> | TValues) | Partial<TValues>) => void
    }
  ) => void
  onMetadataEvent?: (data: unknown) => void
  onThreadId?: (threadId: string) => void
}

/**
 * @description Options for the submit function
 */
export interface SubmitOptions {
  streamMode?: string[]
  checkpoint?: unknown
  config?: unknown
  command?: string
  interruptBefore?: unknown
  interruptAfter?: unknown
  metadata?: unknown
  multitaskStrategy?: string
  onCompletion?: unknown
  onDisconnect?: string
  optimisticValues?:
    | Record<string, unknown>
    | ((values: Record<string, unknown>) => Record<string, unknown>)
}

/**
 * @description Interface for the return value of useStream
 */
export interface StreamInterface<TValues = Record<string, unknown>> {
  values: TValues
  assistantId: string
  error: ComputedRef<Error | undefined>
  isLoading: Ref<boolean>
  branch: Ref<string>
  history: ComputedRef<HistoryState[]>
  experimental_branchTree: ComputedRef<SequenceNode>
  interrupt: unknown
  messages: Message[]
  onThreadId: (threadId: string) => void
  stop: () => void
  submit: (values?: Partial<TValues>, submitOptions?: SubmitOptions) => Promise<void>
  setBranch: (newBranch: string) => void
  getMessagesMetadata: (message: Message, index?: number) => unknown
}
