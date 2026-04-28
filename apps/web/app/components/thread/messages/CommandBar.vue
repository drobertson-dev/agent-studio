<script lang="ts" setup>
import ContentCopyable from './ContentCopyable.vue'

const { content, isHumanMessage, isAiMessage, handleSubmitEdit, handleRegenerate, isLoading } =
  defineProps<{
    content: string
    isHumanMessage?: boolean
    isAiMessage?: boolean
    handleSubmitEdit?: () => void
    handleRegenerate?: () => void
    isLoading: boolean
  }>()

const isEditing = defineModel<boolean>('isEditing', { required: false })

onMounted(() => {
  if (isHumanMessage && isAiMessage) {
    throw new Error('Can only set one of isHumanMessage or isAiMessage to true, not both.')
  }

  if (!isHumanMessage && !isAiMessage) {
    throw new Error('One of isHumanMessage or isAiMessage must be set to true.')
  }
})

const showEdit = computed(() => isHumanMessage && isEditing !== undefined && !!handleSubmitEdit)
</script>

<template>
  <div
    v-if="isHumanMessage && isEditing && !!handleSubmitEdit"
    class="flex items-center gap-2"
  >
    <TooltipIconButton
      :disabled="isLoading"
      tooltip="Cancel edit"
      variant="ghost"
      @click="isEditing = false"
    >
      <Icon name="lucide:x" />
    </TooltipIconButton>
    <TooltipIconButton
      :disabled="isLoading"
      tooltip="Submit"
      variant="secondary"
      @click="handleSubmitEdit"
    >
      <Icon name="lucide:send-horizontal" />
    </TooltipIconButton>
  </div>

  <div
    v-else
    class="flex items-center gap-2"
  >
    <ContentCopyable
      :content="content"
      :disabled="isLoading"
    />
    <TooltipIconButton
      v-if="isAiMessage && !!handleRegenerate"
      :disabled="isLoading"
      tooltip="Refresh"
      variant="ghost"
      @click="handleRegenerate"
    >
      <Icon name="lucide:refresh-ccw" />
    </TooltipIconButton>
    <TooltipIconButton
      v-if="showEdit"
      :disabled="isLoading"
      tooltip="Edit"
      variant="ghost"
      @click="isEditing = true"
    >
      <Icon name="lucide:pencil" />
    </TooltipIconButton>
  </div>
</template>
