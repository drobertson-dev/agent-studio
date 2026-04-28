import { defineWebSocketHandler } from 'h3'

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

type ClientMessage = StreamStartMessage | StreamAbortMessage

type StreamContext = {
  streams: Map<string, AbortController>
}

const getErrorMessage = (error: unknown): string => {
  const data = (error as { data?: unknown })?.data
  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object') {
      const message = (detail as { message?: unknown }).message
      if (typeof message === 'string') return message
    }
  }
  return error instanceof Error ? error.message : 'Unknown error'
}

const ensureContext = (peer: unknown): StreamContext => {
  // @ts-expect-error - peer would need to be retyped it prefers to be inferred
  const existing = peer.context.streams
  if (existing instanceof Map) {
    return { streams: existing }
  }
  const streams = new Map<string, AbortController>()
  // @ts-expect-error - peer would need to be retyped it prefers to be inferred
  peer.context.streams = streams
  return { streams }
}

async function* readNdjson(response: Response): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) return

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      yield JSON.parse(trimmed) as Record<string, unknown>
    }
  }

  buffer += decoder.decode()
  const trimmed = buffer.trim()
  if (trimmed) yield JSON.parse(trimmed) as Record<string, unknown>
}

export default defineWebSocketHandler({
  open(peer) {
    ensureContext(peer)
  },
  async message(peer, message) {
    let data: ClientMessage
    try {
      data = message.json()
    } catch {
      peer.send({ type: 'error', error: { message: 'Invalid JSON payload' } })
      return
    }
    if (!data || typeof data !== 'object' || !('type' in data)) {
      peer.send({ type: 'error', error: { message: 'Malformed message' } })
      return
    }
    if (data.type === 'abort') {
      const ctx = ensureContext(peer)
      const controller = ctx.streams.get(data.id)
      if (controller) {
        controller.abort()
        ctx.streams.delete(data.id)
      }
      return
    }
    if (data.type !== 'start') {
      peer.send({ type: 'error', error: { message: 'Unknown message type' } })
      return
    }

    // The HTTP middleware protects normal API routes. WebSocket upgrades can bypass
    // route middleware in some adapters, so validate the cookie header again here.
    // @ts-expect-error - peer request shape is adapter-specific.
    const cookieHeader = peer.request?.headers?.get?.('cookie') ?? peer.request?.headers?.cookie
    if (!isCookieHeaderAuthenticated(cookieHeader)) {
      peer.send({ type: 'error', id: data.id, error: { message: 'Authentication required' } })
      return
    }

    const ctx = ensureContext(peer)
    const controller = new AbortController()
    ctx.streams.set(data.id, controller)
    const payload = data.payload

    try {
      console.log(`[WS] Starting stream: thread=${data.threadId} assistant=${data.assistantId}`)
      console.log(`[WS] Payload:`, JSON.stringify(payload, null, 2))
      const response = await fetch(runtimeUrl('/runs/stream'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getRuntimeHeaders(),
        },
        body: JSON.stringify({
          thread_id: data.threadId,
          assistant_id: data.assistantId,
          payload,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        let message = response.statusText
        try {
          const body = (await response.json()) as { detail?: unknown; message?: unknown }
          message =
            typeof body.detail === 'string'
              ? body.detail
              : typeof body.message === 'string'
                ? body.message
                : message
        } catch {
          // keep the status text
        }
        throw new Error(message || `Runtime request failed with ${response.status}`)
      }

      for await (const chunk of readNdjson(response)) {
        const event = typeof chunk.event === 'string' ? chunk.event : 'values'
        peer.send({
          type: 'stream',
          id: data.id,
          event,
          data: chunk.data ?? {},
        })
        if (event === 'error') break
      }

      console.log(`[WS] Stream complete`)
      peer.send({ type: 'end', id: data.id })
    } catch (error) {
      const message = getErrorMessage(error)
      console.error(`[WS] Stream error:`, message)
      if (!(error instanceof Error && error.name === 'AbortError')) {
        peer.send({
          type: 'error',
          id: data.id,
          error: {
            message,
            name: error instanceof Error ? error.name : 'Error',
          },
        })
      } else {
        peer.send({ type: 'end', id: data.id })
      }
    } finally {
      ctx.streams.delete(data.id)
    }
  },
  close(peer) {
    const ctx = ensureContext(peer)
    for (const controller of ctx.streams.values()) {
      controller.abort()
    }
    ctx.streams.clear()
  },
})
