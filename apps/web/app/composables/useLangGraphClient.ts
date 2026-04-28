import { createSharedComposable, useWebSocket } from '@vueuse/core'
import { computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'

export type StreamChunk = { event: string; data: unknown }

type StreamQueue<T> = {
  push: (value: T) => void
  close: () => void
  iterator: AsyncIterableIterator<T>
}

type StreamStartMessage = {
  type: 'start'
  id: string
  threadId: string | null
  assistantId: string
  payload: Record<string, unknown>
}

type StreamAbortMessage = {
  type: 'abort'
  id: string
}

type StreamMessage = {
  type: 'stream'
  id: string
  event: string
  data: unknown
}

type StreamEndMessage = {
  type: 'end'
  id: string
}

type StreamErrorMessage = {
  type: 'error'
  id?: string
  error?: {
    message?: string
    name?: string
  }
}

type WsIncoming = StreamMessage | StreamEndMessage | StreamErrorMessage

type RunsStreamOptions = Record<string, unknown> & {
  signal?: AbortSignal
}

const createAsyncQueue = <T>(): StreamQueue<T> => {
  const values: T[] = []
  const resolvers: Array<(result: IteratorResult<T>) => void> = []
  let closed = false

  const iterator: AsyncIterableIterator<T> = {
    [Symbol.asyncIterator]() {
      return this
    },
    next() {
      if (values.length) {
        return Promise.resolve({ value: values.shift() as T, done: false })
      }
      if (closed) {
        return Promise.resolve({ value: undefined as T, done: true })
      }
      return new Promise((resolve) => {
        resolvers.push(resolve)
      })
    },
    return() {
      closed = true
      return Promise.resolve({ value: undefined as T, done: true })
    },
  }

  const push = (value: T) => {
    if (closed) return
    const resolve = resolvers.shift()
    if (resolve) {
      resolve({ value, done: false })
      return
    }
    values.push(value)
  }

  const close = () => {
    if (closed) return
    closed = true
    while (resolvers.length) {
      const resolve = resolvers.shift()
      if (resolve) {
        resolve({ value: undefined as T, done: true })
      }
    }
  }

  return { push, close, iterator }
}

const createWsUrl = () => {
  if (!import.meta.client) return ''
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/_ws/langgraph`
}

export const useLangGraphClient = createSharedComposable(() => {
  const pendingStreams = new Map<string, StreamQueue<StreamChunk>>()

  const wsUrl = computed(createWsUrl)
  const socket = import.meta.client
    ? useWebSocket(wsUrl, {
        immediate: false,
        autoReconnect: true,
        onMessage: (_ws, event) => {
          if (typeof event.data !== 'string') return
          let payload: WsIncoming
          try {
            payload = JSON.parse(event.data) as WsIncoming
          } catch {
            return
          }

          if (!payload || typeof payload !== 'object' || !('type' in payload)) return

          if (payload.type === 'stream') {
            const queue = pendingStreams.get(payload.id)
            queue?.push({ event: payload.event, data: payload.data })
            return
          }

          if (payload.type === 'end') {
            const queue = pendingStreams.get(payload.id)
            queue?.close()
            pendingStreams.delete(payload.id)
            return
          }

          if (payload.type === 'error' && payload.id) {
            const queue = pendingStreams.get(payload.id)
            queue?.push({ event: 'error', data: payload.error ?? { message: 'Unknown error' } })
            queue?.close()
            pendingStreams.delete(payload.id)
          }
        },
        onDisconnected: () => {
          for (const [id, queue] of pendingStreams.entries()) {
            queue.push({
              event: 'error',
              data: { message: 'WebSocket disconnected', name: 'WebSocketDisconnected' },
            })
            queue.close()
            pendingStreams.delete(id)
          }
        },
      })
    : null

  const ensureSocketOpen = () => {
    if (!socket) return
    if (!wsUrl.value) return
    if (socket.status.value !== 'OPEN') {
      socket.open()
    }
  }

  const send = (message: StreamStartMessage | StreamAbortMessage) => {
    if (!socket) return false
    ensureSocketOpen()
    return socket.send(JSON.stringify(message))
  }

  const threads = {
    create: () => $fetch('/api/langgraph/threads', { method: 'POST' }),
    search: (body: Record<string, unknown>) =>
      $fetch('/api/langgraph/threads/search', { method: 'POST', body }),
    getHistory: (threadId: string, options?: { limit?: number }) =>
      $fetch(`/api/langgraph/threads/${threadId}/history`, {
        query: { limit: options?.limit ?? 5 },
      }),
    delete: (threadId: string) =>
      $fetch(`/api/langgraph/threads/${threadId}`, { method: 'DELETE' }),
  }

  const runs = {
    stream: (threadId: string | null, assistantId: string, options: RunsStreamOptions) => {
      const id = uuidv4()
      const queue = createAsyncQueue<StreamChunk>()
      pendingStreams.set(id, queue)

      if (!socket) {
        queue.push({
          event: 'error',
          data: { message: 'WebSocket is unavailable in this environment' },
        })
        queue.close()
        pendingStreams.delete(id)
        return queue.iterator
      }

      const { signal, ...payload } = options ?? {}
      if (signal) {
        if (signal.aborted) {
          send({ type: 'abort', id })
          queue.close()
          pendingStreams.delete(id)
          return queue.iterator
        }
        signal.addEventListener(
          'abort',
          () => {
            send({ type: 'abort', id })
            queue.close()
            pendingStreams.delete(id)
          },
          { once: true }
        )
      }

      send({
        type: 'start',
        id,
        threadId,
        assistantId,
        payload,
      })

      return queue.iterator
    },
  }

  return {
    threads,
    runs,
    socketStatus: socket?.status,
  }
})
