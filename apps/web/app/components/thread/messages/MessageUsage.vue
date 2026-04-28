<script setup lang="ts">
import type { UsageMetadata } from '@langchain/core/messages'

const props = defineProps<{
  usage: UsageMetadata
}>()

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value)
}

const reasoningTokens = computed(() => props.usage.output_token_details?.reasoning)

const inputDetails = computed(() =>
  Object.entries(props.usage.input_token_details ?? {}).filter(
    ([, value]) => typeof value === 'number' && value > 0
  )
)

const outputDetails = computed(() =>
  Object.entries(props.usage.output_token_details ?? {}).filter(
    ([, value]) => typeof value === 'number' && value > 0
  )
)
</script>

<template>
  <details class="w-fit max-w-full rounded-md border bg-muted/40 px-3 py-2">
    <summary class="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground">
      Tokens:
      <span class="font-mono text-foreground">{{ formatCount(usage.total_tokens) }}</span>
      <span class="ml-2 text-muted-foreground">
        in
        <span class="font-mono text-foreground">{{ formatCount(usage.input_tokens) }}</span>
        · out
        <span class="font-mono text-foreground">{{ formatCount(usage.output_tokens) }}</span>
      </span>
      <span
        v-if="typeof reasoningTokens === 'number'"
        class="ml-2 text-muted-foreground"
      >
        · reasoning
        <span class="font-mono text-foreground">{{ formatCount(reasoningTokens) }}</span>
      </span>
    </summary>

    <div class="mt-2 grid gap-2 text-xs">
      <div
        v-if="inputDetails.length"
        class="rounded bg-muted/30 p-2"
      >
        <div class="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Input Details
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          <span
            v-for="[key, value] in inputDetails"
            :key="key"
            class="text-muted-foreground"
          >
            {{ key }}: <span class="font-mono text-foreground">{{ formatCount(value) }}</span>
          </span>
        </div>
      </div>

      <div
        v-if="outputDetails.length"
        class="rounded bg-muted/30 p-2"
      >
        <div class="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Output Details
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          <span
            v-for="[key, value] in outputDetails"
            :key="key"
            class="text-muted-foreground"
          >
            {{ key }}: <span class="font-mono text-foreground">{{ formatCount(value) }}</span>
          </span>
        </div>
      </div>
    </div>
  </details>
</template>
