<script setup lang="ts">
defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()

const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    emit('submit')
  }
}
</script>

<template>
  <Textarea
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', String($event))"
    @keydown="handleKeyDown"
    class="focus-visible:ring-0"
  />
</template>
