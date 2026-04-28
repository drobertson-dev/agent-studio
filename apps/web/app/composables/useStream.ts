import type { Message } from '@langchain/core/messages'
import { useStream as useLangChainStream } from '../lib/stream'
import { useThreads } from './useThreads'
import { toast } from 'vue-sonner'
import { createSharedComposable, toReactive } from '@vueuse/core'
import { DEFAULT_ASSISTANT_ID } from '~/lib/studio-starter'

// --- UI Message types ---
export interface UIMessage {
  type: 'ui'
  id: string
  name: string
  props: Record<string, unknown>
  metadata: {
    run_id: string
    message_id?: string
    [key: string]: unknown
  }
}

export interface RemoveUIMessage {
  type: 'remove-ui'
  id: string
}

// --- Stream state type ---
export type StateType = { messages: Message[]; ui?: UIMessage[] }

// --- UI Message handling ---
function uiMessageReducer(
  state: UIMessage[],
  update: UIMessage | RemoveUIMessage | (UIMessage | RemoveUIMessage)[]
) {
  const events = Array.isArray(update) ? update : [update]
  let newState = state.slice()
  for (const event of events) {
    if (event.type === 'remove-ui') {
      newState = newState.filter((ui) => ui.id !== event.id)
      continue
    }
    const index = state.findIndex((ui) => ui.id === event.id)
    if (index === -1) {
      newState.push(event)
    } else {
      newState[index] = event
    }
  }
  return newState
}

// --- Utility functions ---
async function sleep(ms = 4000) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function checkGraphStatus(): Promise<boolean> {
  try {
    await $fetch('/api/langgraph/info')
    return true
  } catch (e) {
    console.error(e)
    return false
  }
}

// --- API connection handling function ---
function useApiConnection() {
  const route = useRoute()

  const assistantId = computed(() => (route.query.assistantId as string) || DEFAULT_ASSISTANT_ID)
  const threadId = computed(() => route.query.threadId as string)

  // Check connection status
  const checkConnection = () => {
    watch(
      [assistantId],
      () => {
        if (!assistantId.value) return
        checkGraphStatus().then((ok) => {
          if (!ok) {
            toast.error('Failed to connect to the Agent Studio runtime', {
              description:
                'Please ensure the runtime container is reachable and the server environment is configured.',
              duration: 10_000,
              richColors: true,
              closeButton: true,
            })
          }
        })
      },
      { immediate: true }
    )
  }

  return {
    assistantId,
    threadId,
    checkConnection,
  }
}

// --- Thread ID handling function ---
function useThreadHandling() {
  const route = useRoute()
  const router = useRouter()
  const threadsManager = useThreads()

  const updateThreadId = (id: string) => {
    if (!id) return
    if (id === route.query.threadId) return

    // Update the URL with the thread ID
    const newQuery = { ...route.query, threadId: id }
    router.push({ query: newQuery })
    // Refetch threads list when thread ID changes
    sleep().then(() => threadsManager.getThreads({ background: true }).catch(console.error))
  }

  return {
    updateThreadId,
    threadsManager,
  }
}

// --- Main shared composable ---
export const useStream = createSharedComposable(() => {
  // Connection handling
  const { assistantId, threadId, checkConnection } = useApiConnection()

  // Thread handling
  const { updateThreadId } = useThreadHandling()

  // Check API connection
  checkConnection()

  // Create the stream with LangChain
  const streamValue = useLangChainStream<
    StateType,
    { UpdateType: unknown; CustomEventType: UIMessage | RemoveUIMessage }
  >({
    assistantId: assistantId.value,
    threadId: threadId.value ?? null,
    onCustomEvent: (event, options) => {
      options.mutate((prev: StateType) => {
        const ui = uiMessageReducer(prev.ui ?? [], event)
        return { ...prev, ui }
      })
    },
    onThreadId: updateThreadId,
  })

  watch(threadId, (newThreadId) => {
    streamValue.onThreadId(newThreadId)
  })

  // Return reactive stream interface
  return toReactive({
    threadId,
    stream: toReactive(streamValue),
  })
})
