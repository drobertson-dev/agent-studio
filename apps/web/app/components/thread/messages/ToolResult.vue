<!--suppress CssUnusedSymbol -->
<script setup lang="ts">
import type { ToolMessage } from '@langchain/core/messages'
import { getMessageContentBlocks } from '~/lib/messages/content-blocks'
import ContentBlocks from '~/components/thread/messages/ContentBlocks.vue'

const props = defineProps<{
  message: ToolMessage
}>()

const contentBlocks = computed(() => getMessageContentBlocks(props.message))
const renderBlocks = computed(() => {
  if (!contentBlocks.value.length) return false
  if (typeof props.message.content !== 'string') return true
  return contentBlocks.value.some((block) => block.type !== 'text')
})

const parsedContent = computed<unknown>(() => {
  if (typeof props.message.content !== 'string') {
    return props.message.content
  }
  try {
    return JSON.parse(props.message.content)
  } catch {
    return props.message.content
  }
})

const contentStr = computed(() => {
  if (typeof parsedContent.value !== 'string') {
    return JSON.stringify(parsedContent.value, null, 2)
  }
  return String(parsedContent.value)
})
</script>

<template>
  <details class="min-w-0 max-w-full rounded-md border bg-muted/40">
    <summary class="flex min-w-0 cursor-pointer items-center justify-between gap-2 px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <span class="text-xs font-semibold tracking-wide text-muted-foreground">Tool Result</span>
        <code
          v-if="message.name"
          class="truncate rounded bg-muted/60 px-1 py-0.5 text-xs"
        >
          {{ message.name }}
        </code>
      </div>
      <code
        v-if="message.tool_call_id"
        class="min-w-0 break-all text-xs text-muted-foreground"
      >
        {{ message.tool_call_id }}
      </code>
    </summary>

    <div class="px-3 pb-3">
      <ContentBlocks
        v-if="renderBlocks"
        :blocks="contentBlocks"
        :hide-tool-calls="true"
      />
      <pre
        v-else
        class="max-h-96 overflow-x-hidden overflow-y-auto rounded bg-muted/30 p-2 font-mono text-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
        >{{ contentStr }}</pre
      >
    </div>
  </details>
</template>
