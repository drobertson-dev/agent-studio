import type { Message } from '@langchain/core/messages'
import { getMessageContentBlocks, getTextFromBlocks } from '~/lib/messages/content-blocks'

export function getContentString(content: Message['content'] | Message): string {
  const blocks = getMessageContentBlocks(content)
  if (!blocks.length && typeof content === 'string') return content
  return getTextFromBlocks(blocks)
}
