<script setup lang="ts">
import type { ContentBlock } from '~/lib/messages/content-blocks'
import MarkdownText from '~/components/thread/messages/MarkdownText.vue'
import ToolCalls from '~/components/thread/messages/ToolCalls.vue'
import ReasoningBlock from '~/components/thread/messages/ReasoningBlock.vue'
import MediaBlock from '~/components/thread/messages/MediaBlock.vue'
import ToolCallResultBlock from '~/components/thread/messages/ToolCallResultBlock.vue'
import { getVisibleContentBlocks, isToolContentBlock } from '~/lib/tool-visibility'
import { normalizeToolCall, type ToolCallLike } from '~/lib/tool-calls'

const props = defineProps<{
  blocks: ContentBlock[]
  hideToolCalls?: boolean
  reasoningTokens?: number
  toolCalls?: ToolCallLike[]
}>()

const isToolCallBlock = (block: ContentBlock) =>
  block.type === 'tool_call' || block.type === 'server_tool_call'

const isToolCallChunk = (block: ContentBlock) =>
  block.type === 'tool_call_chunk' || block.type === 'server_tool_call_chunk'

const isMediaBlock = (block: ContentBlock) =>
  block.type === 'image' ||
  block.type === 'video' ||
  block.type === 'audio' ||
  block.type === 'file' ||
  block.type === 'text-plain'

const toToolCall = (block: ContentBlock) =>
  normalizeToolCall(block as ToolCallLike, props.toolCalls ?? [])

const blocks = computed(() => getVisibleContentBlocks(props.blocks ?? [], props.hideToolCalls === true))
</script>

<template>
  <div class="flex min-w-0 max-w-full flex-col gap-2">
    <template
      v-for="(block, idx) in blocks"
      :key="`${block.type}-${idx}`"
    >
      <MarkdownText
        v-if="block.type === 'text'"
        :content="String(block.text ?? '')"
      />

      <ReasoningBlock
        v-else-if="block.type === 'reasoning'"
        :text="String(block.reasoning ?? '')"
        :reasoning-tokens="props.hideToolCalls ? undefined : props.reasoningTokens"
      />

      <MediaBlock
        v-else-if="isMediaBlock(block)"
        :block="block"
      />

      <ToolCalls
        v-else-if="isToolCallBlock(block)"
        :tool-calls="[toToolCall(block)]"
      />

      <ToolCallResultBlock
        v-else-if="
          block.type === 'server_tool_call_result' ||
          block.type === 'server_tool_result' ||
          block.type === 'tool_call_result' ||
          block.type === 'tool_result'
        "
        :result="block"
      />

      <details
        v-else-if="isToolCallChunk(block)"
        class="min-w-0 max-w-full rounded-md border bg-muted/40 p-3"
      >
        <summary class="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground">
          Partial tool call
        </summary>
        <pre
          class="mt-2 max-h-80 overflow-x-hidden overflow-y-auto rounded bg-muted/30 p-2 font-mono text-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          >{{ JSON.stringify(block, null, 2) }}</pre
        >
      </details>

      <div
        v-else-if="!isToolContentBlock(block)"
        class="min-w-0 max-w-full rounded-md border bg-muted/30 p-3 text-sm"
      >
        <code class="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{{
          JSON.stringify(block, null, 2)
        }}</code>
      </div>
    </template>
  </div>
</template>
