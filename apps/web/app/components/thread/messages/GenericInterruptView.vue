<!--suppress CssUnusedSymbol -->
<script setup lang="ts">
import { isComplexValue } from './utils'

const props = defineProps<{
  interrupt: Record<string, unknown> | unknown[]
}>()

const isExpanded = ref(false)

const contentStr = computed(() => {
  return JSON.stringify(props.interrupt, null, 2)
})

const contentLines = computed(() => contentStr.value.split('\n'))
const shouldTruncate = computed(
  () => contentLines.value.length > 4 || contentStr.value.length > 500
)

// Function to truncate long string values
function truncateValue(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 100) {
    return `${value.substring(0, 100)}...`
  }

  if (Array.isArray(value) && !isExpanded.value) {
    return value.slice(0, 2).map(truncateValue)
  }

  if (isComplexValue(value) && !isExpanded.value) {
    const strValue = JSON.stringify(value, null, 2)
    if (strValue.length > 100) {
      // Return plain text for truncated content instead of a JSON object
      return `Truncated ${strValue.length} characters...`
    }
  }

  return value
}

// Process entries based on expanded state
const displayEntries = computed(() => {
  if (Array.isArray(props.interrupt)) {
    return isExpanded.value ? props.interrupt : props.interrupt.slice(0, 5)
  }
  const entries = Object.entries(props.interrupt)
  if (!isExpanded.value && shouldTruncate.value) {
    // When collapsed, process each value to potentially truncate it
    return entries.map(([key, value]) => [key, truncateValue(value)])
  }
  return entries
})

const shouldShowExpandButton = computed(() => {
  return shouldTruncate.value || (Array.isArray(props.interrupt) && props.interrupt.length > 5)
})

// Helper functions for handling array or object items
function getKeyFromItem(item: unknown, index: number): string {
  if (Array.isArray(props.interrupt)) return index.toString()
  if (Array.isArray(item) && typeof item[0] === 'string') return item[0]
  return index.toString()
}

function getValueFromItem(item: unknown): unknown {
  if (Array.isArray(props.interrupt)) return item
  if (Array.isArray(item)) return item[1]
  return item
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border">
    <div class="border-b px-4 py-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-medium">Human Interrupt</h3>
      </div>
    </div>

    <div class="min-w-full bg-gray-100">
      <div class="p-3">
        <Transition
          name="fade"
          mode="out-in"
        >
          <div
            :key="isExpanded ? 'expanded' : 'collapsed'"
            :style="{
              maxHeight: isExpanded ? 'none' : '500px',
              overflow: 'auto',
            }"
          >
            <table class="min-w-full divide-y">
              <tbody class="divide-y">
                <tr
                  v-for="(item, argIdx) in displayEntries"
                  :key="argIdx"
                >
                  <td class="px-4 py-2 text-sm font-medium whitespace-nowrap">
                    {{ getKeyFromItem(item, argIdx) }}
                  </td>
                  <td class="px-4 py-2 text-sm">
                    <code
                      v-if="isComplexValue(getValueFromItem(item))"
                      class="rounded px-2 py-1 font-mono text-sm"
                    >
                      {{ JSON.stringify(getValueFromItem(item), null, 2) }}
                    </code>
                    <template v-else>{{ String(getValueFromItem(item)) }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Transition>
      </div>

      <Button
        variant="ghost"
        size="icon"
        v-if="shouldShowExpandButton"
        @click="isExpanded = !isExpanded"
      >
        <Icon
          name="lucide:chevron-up"
          v-if="isExpanded"
        />
        <Icon
          name="lucide:chevron-down"
          v-else
        />
      </Button>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
