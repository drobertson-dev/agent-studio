<script setup lang="ts">
import type { Component } from 'vue'
import type { Message } from '@langchain/core/messages'
import { useStream } from '#imports'

const props = defineProps<{
  message: Message
  thread: unknown
}>()

const { stream } = useStream()
type LoadedComponent = { component: string | Component; props: Record<string, unknown> }
type UIComponentMessage = { id: string; metadata?: { message_id?: string } }

const isUIComponentMessage = (value: unknown): value is UIComponentMessage => {
  return typeof value === 'object' && value !== null && 'id' in value
}

const loadedComponents = ref<Record<string, LoadedComponent>>({})

const customComponents = computed(() => {
  const values = stream.values as Record<string, unknown>
  const ui = values?.ui
  const items = Array.isArray(ui) ? ui : []
  return items.filter(
    (item): item is UIComponentMessage =>
      isUIComponentMessage(item) && item.metadata?.message_id === props.message.id
  )
})

// This would be replaced by your actual external component loading logic
// For now, it's a placeholder
onMounted(() => {
  if (customComponents.value?.length) {
    customComponents.value.forEach((component) => {
      // In Vue, you would need to dynamically import or register these components
      // This is a simplified placeholder
      loadedComponents.value[component.id] = {
        component: 'div', // Placeholder
        props: {
          class: 'bg-muted/50 p-4 rounded-md',
          innerHTML: `External component with ID: ${component.id}`,
        },
      }
    })
  }
})
</script>

<template>
  <div v-if="customComponents && customComponents.length">
    <component
      v-for="customComponent in customComponents"
      :key="customComponent.id"
      :is="loadedComponents[customComponent.id]?.component"
      v-bind="loadedComponents[customComponent.id]?.props"
    />
  </div>
</template>
