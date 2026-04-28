import { validate } from 'uuid'
import type { Ref } from 'vue'
import type { Thread } from '@langchain/langgraph-sdk'
import { createSharedComposable } from '@vueuse/core'
import { useLangGraphClient } from '~/composables/useLangGraphClient'
import { DEFAULT_ASSISTANT_ID } from '~/lib/studio-starter'

interface ThreadContextType {
  getThreads: (options?: { background?: boolean }) => Promise<Thread[]>
  deleteThread: (threadId: string) => Promise<void>
  threads: Ref<Thread[]>
  threadsLoading: Ref<boolean>
  threadsRefreshing: Ref<boolean>
}

function getThreadSearchMetadata(
  assistantId: string
): { graph_id: string } | { assistant_id: string } {
  if (validate(assistantId)) {
    return { assistant_id: assistantId }
  } else {
    return { graph_id: assistantId }
  }
}

export const useThreads = createSharedComposable((): ThreadContextType => {
  const route = useRoute()
  const assistantId = computed(() => (route.query.assistantId as string) || DEFAULT_ASSISTANT_ID)
  const client = useLangGraphClient()

  // Threads can contain large nested values (messages, checkpoints, etc.). Keeping this shallow
  // prevents Vue from creating reactive proxies for deep thread state, which can cause
  // significant performance degradation during streaming.
  const threads = shallowRef<Thread[]>([])
  const threadsLoading = ref(false)
  const threadsRefreshing = ref(false)

  const getThreads = async (options?: { background?: boolean }): Promise<Thread[]> => {
    if (!assistantId.value) return []

    const isBackground = options?.background === true
    if (isBackground) {
      threadsRefreshing.value = true
    } else {
      threadsLoading.value = true
    }

    try {
      const fetchedThreads = await client.threads.search({
        metadata: {
          ...getThreadSearchMetadata(assistantId.value),
        },
        limit: 100,
      })

      threads.value = fetchedThreads
      return fetchedThreads
    } catch (error) {
      console.error('Error fetching threads:', error)
      return []
    } finally {
      threadsLoading.value = false
      threadsRefreshing.value = false
    }
  }

  const deleteThread = async (threadId: string): Promise<void> => {
    await client.threads.delete(threadId)
    // Remove from local list immediately
    threads.value = threads.value.filter((t) => t.thread_id !== threadId)
  }

  return {
    getThreads,
    deleteThread,
    threads,
    threadsLoading,
    threadsRefreshing,
  }
})
