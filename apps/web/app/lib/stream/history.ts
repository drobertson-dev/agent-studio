import { ref, watch, onMounted } from 'vue'
import type { Ref } from 'vue'
import type { HistoryState } from './branches'

type ThreadHistoryClient = {
  threads: {
    getHistory: (threadId: string, options?: { limit?: number }) => Promise<HistoryState[]>
  }
}

/**
 * Fetches history for a thread from the LangGraph server
 */
export function fetchHistory(
  client: ThreadHistoryClient,
  threadId: string
): Promise<HistoryState[]> {
  return client.threads.getHistory(threadId, { limit: 5 })
}

export interface UseThreadHistoryOptions {
  mutate: (mutateId?: string) => Promise<HistoryState[]>
  data: Ref<HistoryState[]>
}

/**
 * Manages history for a thread, handling fetching and updating
 */
export function useThreadHistory(
  threadId: Ref<string | null>,
  client: ThreadHistoryClient,
  clearCallback: () => void,
  isSubmitting: Ref<boolean>
): UseThreadHistoryOptions {
  const history = ref<HistoryState[]>([])

  // Monotonic fetch counter — only the latest fetch wins.
  // Prevents race conditions where a stale response overwrites fresh data.
  let fetchGeneration = 0

  const fetcher = async (threadIdToFetch?: string | null): Promise<HistoryState[]> => {
    const thisGeneration = ++fetchGeneration

    if (threadIdToFetch != null) {
      try {
        const historyData = await fetchHistory(client, threadIdToFetch)
        // Only apply if no newer fetch has started while we were awaiting
        if (thisGeneration === fetchGeneration) {
          history.value = historyData
        }
        return historyData
      } catch (e) {
        console.error('[useThreadHistory] Failed to fetch history:', e)
        if (thisGeneration === fetchGeneration) {
          history.value = []
        }
        return []
      }
    }
    if (thisGeneration === fetchGeneration) {
      history.value = []
      clearCallback()
    }
    return []
  }

  watch(
    () => threadId.value,
    (newThreadId) => {
      if (!isSubmitting.value) {
        fetcher(newThreadId)
      }
    }
  )

  onMounted(() => {
    if (!isSubmitting.value) {
      fetcher(threadId.value)
    }
  })

  return {
    data: history,
    mutate: (mutateId?: string) => fetcher(mutateId ?? threadId.value),
  }
}

export interface UseControllableThreadIdOptions {
  threadId?: string | null
  onThreadId?: (threadId: string) => void
}

/**
 * Manages a thread ID, handling both controlled and uncontrolled scenarios
 */
export function useControllableThreadId(
  options?: UseControllableThreadIdOptions
): [Ref<string | null>, (threadId: string) => void] {
  const localThreadId = ref<string | null>(options?.threadId ?? null)
  const onThreadIdCallback = options?.onThreadId
  const onThreadId = (threadId: string): void => {
    localThreadId.value = threadId
    onThreadIdCallback?.(threadId)
  }

  return [localThreadId, onThreadId]
}
