import type { Message } from '@langchain/core/messages'
import { getMessageContentBlocks } from '~/lib/messages/content-blocks'

type MessageLike = Partial<Message> & {
  type?: unknown
  content?: unknown
  tool_calls?: unknown
}

type ContentBlockLike = {
  type?: unknown
  text?: unknown
}

export function isToolMessage(message: MessageLike): boolean {
  const type = String(message.type ?? '').toLowerCase()
  return type === 'tool' || type === 'toolmessage'
}

export function isToolContentBlock(block: ContentBlockLike): boolean {
  return String(block.type ?? '')
    .toLowerCase()
    .includes('tool')
}

export function getVisibleContentBlocks(messageOrBlocks: unknown, hideToolCalls: boolean) {
  const blocks = getMessageContentBlocks(messageOrBlocks)
  if (!hideToolCalls) return blocks
  return blocks.filter((block) => !isToolContentBlock(block))
}

function hasVisibleContent(message: MessageLike): boolean {
  const blocks = getVisibleContentBlocks(message, true)
  if (!blocks.length) return false
  return blocks.some((block) => {
    if (block.type !== 'text') return true
    return typeof block.text === 'string' && block.text.trim().length > 0
  })
}

export function shouldRenderMessage(message: MessageLike, hideToolCalls: boolean): boolean {
  if (!hideToolCalls) return true
  if (isToolMessage(message)) return false

  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []
  if (toolCalls.length > 0 && !hasVisibleContent(message)) return false

  return true
}
