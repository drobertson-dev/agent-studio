<script setup lang="ts">
import MarkdownText from '~/components/thread/messages/MarkdownText.vue'

const props = defineProps<{
  text: string
  reasoningTokens?: number
}>()
</script>

<template>
  <details class="rounded-md border bg-muted/40 p-3">
    <summary class="flex cursor-pointer items-center justify-between gap-2">
      <span class="text-xs font-semibold tracking-wide text-muted-foreground">Reasoning</span>
      <span
        v-if="typeof props.reasoningTokens === 'number'"
        class="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
      >
        {{ props.reasoningTokens }} tokens
      </span>
    </summary>
    <div class="mt-2 text-sm">
      <MarkdownText :content="props.text" />
    </div>
  </details>
</template>
