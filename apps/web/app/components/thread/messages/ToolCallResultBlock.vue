<script setup lang="ts">
import type { ContentBlock } from '~/lib/messages/content-blocks'

const props = defineProps<{
  result: ContentBlock
}>()

const output = computed(
  () => props.result.output ?? props.result.result ?? props.result.content ?? props.result
)
const status = computed(() => String(props.result.status ?? props.result.state ?? 'unknown'))
const toolCallId = computed(() =>
  String(
    props.result.toolCallId ??
      props.result.callId ??
      props.result.tool_call_id ??
      props.result.id ??
      ''
  )
)

const outputStr = computed(() => {
  if (typeof output.value === 'string') return output.value
  try {
    return JSON.stringify(output.value, null, 2)
  } catch {
    return String(output.value)
  }
})
</script>

<template>
  <details class="min-w-0 max-w-full rounded-md border bg-muted/40">
    <summary class="flex min-w-0 cursor-pointer items-center justify-between gap-2 px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <span class="text-xs font-semibold tracking-wide text-muted-foreground">
          Server Tool Result
        </span>
        <span class="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground uppercase">
          {{ status }}
        </span>
      </div>
      <code
        v-if="toolCallId"
        class="min-w-0 break-all text-xs text-muted-foreground"
      >
        {{ toolCallId }}
      </code>
    </summary>
    <div class="px-3 pb-3">
      <pre
        class="max-h-96 overflow-x-hidden overflow-y-auto rounded bg-muted/30 p-2 font-mono text-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
        >{{ outputStr }}</pre
      >
    </div>
  </details>
</template>
