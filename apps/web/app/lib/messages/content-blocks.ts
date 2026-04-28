import type { BaseMessageLike } from '@langchain/core/messages'
import { coerceMessageLikeToMessage } from '@langchain/core/messages'
import type { ContentBlock } from '@langchain/core/messages'

const isContentBlockArray = (value: unknown): value is ContentBlock[] =>
  Array.isArray(value) &&
  value.every((block) => block && typeof block === 'object' && 'type' in (block as ContentBlock))

export function getMessageContentBlocks(messageOrContent: unknown): ContentBlock[] {
  if (!messageOrContent) return []

  if (isContentBlockArray(messageOrContent)) return messageOrContent

  if (typeof messageOrContent === 'string') {
    return [{ type: 'text', text: messageOrContent }]
  }

  try {
    const message = coerceMessageLikeToMessage(messageOrContent as BaseMessageLike) as {
      content?: unknown
      contentBlocks?: unknown
      content_blocks?: unknown
    }
    const blocks = message.contentBlocks ?? message.content_blocks
    if (isContentBlockArray(blocks)) return blocks
    if (typeof message.content === 'string') {
      return [{ type: 'text', text: message.content }]
    }
    if (isContentBlockArray(message.content)) return message.content
  } catch {
    // no-op
  }

  return []
}

export function getTextFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => String(block.text))
    .join(' ')
}
