import type { BaseMessage, BaseMessageLike } from '@langchain/core/messages'
import { BaseMessageChunk } from '@langchain/core/messages'
import { coerceMessageLikeToMessage, convertToChunk } from '@langchain/core/messages'

export interface StreamErrorData {
  message: string
  name?: string
  error?: string
}

export class StreamError extends Error {
  constructor(data: StreamErrorData) {
    super(data.message)
    this.name = data.name ?? data.error ?? 'StreamError'
  }
  static isStructuredError(error: unknown): error is StreamErrorData {
    return typeof error === 'object' && error != null && 'message' in error
  }
}

export function tryConvertToChunk(message: BaseMessage): BaseMessageChunk | null {
  try {
    return convertToChunk(message)
  } catch {
    return null
  }
}

export interface MessageTuple {
  chunk?: BaseMessageChunk | BaseMessage
  index?: number
}

export class MessageTupleManager {
  private chunks: Record<string, MessageTuple> = {}

  add(serialized: BaseMessageLike): string | null {
    // TODO: this is sometimes sent from the API
    // figure out how to prevent this or move this to LC.js
    if (typeof serialized === 'object' && serialized !== null && 'type' in serialized) {
      const typeValue = (serialized as { type?: unknown }).type
      if (typeof typeValue === 'string' && typeValue.endsWith('MessageChunk')) {
        ;(serialized as { type: string }).type = typeValue
          .slice(0, -'MessageChunk'.length)
          .toLowerCase()
      }
    }
    const message = coerceMessageLikeToMessage(serialized)
    const chunk = tryConvertToChunk(message)
    const { id } = chunk ?? message
    if (!id) {
      console.warn('No message ID found for chunk, ignoring in state', serialized)
      return null
    }
    this.chunks[id] ??= {}
    if (chunk) {
      const prev = this.chunks[id].chunk
      this.chunks[id].chunk =
        (BaseMessageChunk.isInstance(prev) ? prev : null)?.concat(chunk) ?? chunk
    } else {
      this.chunks[id].chunk = message
    }
    return id
  }

  clear(): void {
    this.chunks = {}
  }

  get(id: string, defaultIndex: number): MessageTuple | null {
    if (this.chunks[id] == null) return null
    this.chunks[id].index ??= defaultIndex
    return this.chunks[id]
  }
}

export const toMessageDict = (chunk: BaseMessageChunk): Record<string, unknown> => {
  const { type, data } = chunk.toDict()
  return { ...data, type }
}
