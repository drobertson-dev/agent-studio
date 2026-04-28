<script setup lang="ts">
import {
  formatToolArgs,
  getToolArgsCount,
  normalizeToolCall,
  type ToolCallLike,
} from '~/lib/tool-calls'

const props = defineProps<{
  toolCalls: ToolCallLike[]
}>()

function getLabel(toolCall: ToolCallLike): string {
  const normalized = normalizeToolCall(toolCall)
  if (normalized.type === 'server_tool_call') return 'Server Tool Call'
  return 'Tool Call'
}

function getArgsSummary(toolCall: ToolCallLike): string {
  const count = getToolArgsCount(normalizeToolCall(toolCall).args)
  if (count === 0) return 'no args'
  if (count === 1) return '1 arg'
  return `${count} args`
}

const normalizedToolCalls = computed(() =>
  props.toolCalls.map((toolCall) => normalizeToolCall(toolCall))
)
</script>

<template>
  <div
    v-if="toolCalls && toolCalls.length > 0"
    class="flex min-w-0 max-w-full flex-col gap-2"
  >
    <details
      v-for="(tc, idx) in normalizedToolCalls"
      :key="idx"
      class="min-w-0 max-w-full rounded-md border bg-muted/40"
    >
      <summary class="flex min-w-0 cursor-pointer items-center justify-between gap-2 px-3 py-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="text-xs font-semibold tracking-wide text-muted-foreground">
            {{ getLabel(tc) }}
          </span>
          <code class="truncate rounded bg-muted/60 px-1 py-0.5 text-xs">
            {{ tc.name || 'tool' }}
          </code>
          <span class="text-xs text-muted-foreground">{{ getArgsSummary(tc) }}</span>
        </div>
        <code
          v-if="tc.id"
          class="min-w-0 break-all text-xs text-muted-foreground"
        >
          {{ tc.id }}
        </code>
      </summary>
      <div class="px-3 pb-3">
        <pre
          class="max-h-80 overflow-x-hidden overflow-y-auto rounded bg-muted/30 p-2 font-mono text-xs whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          >{{ formatToolArgs(tc.args) }}</pre
        >
      </div>
    </details>
  </div>
</template>
