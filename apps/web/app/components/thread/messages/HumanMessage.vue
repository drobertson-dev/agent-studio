<script setup lang="ts">
import type { Message } from '@langchain/core/messages'
import { getContentString } from '~/utils/getContentString'
import { getMessageContentBlocks } from '~/lib/messages/content-blocks'
import { useStream } from '#imports'
import BranchSwitcher from '~/components/thread/messages/BranchSwitcher.vue'
import CommandBar from '~/components/thread/messages/CommandBar.vue'
import EditableContent from '~/components/thread/messages/EditableContent.vue'
import ContentBlocks from '~/components/thread/messages/ContentBlocks.vue'

const props = defineProps<{
  message: Message
  isLoading: boolean
}>()

const { stream: thread } = useStream()
const meta = computed(() => thread.getMessagesMetadata(props.message))
const parentCheckpoint = computed(() => meta.value?.firstSeenState?.parent_checkpoint)

const isEditing = ref(false)
const editValue = ref('')
const contentString = computed(() => getContentString(props.message))
const contentBlocks = computed(() => getMessageContentBlocks(props.message))
const hasNonTextBlocks = computed(() => contentBlocks.value.some((block) => block.type !== 'text'))

function handleSetIsEditing(value: boolean | undefined) {
  if (value) {
    editValue.value = contentString.value
  }
}

function handleSubmitEdit() {
  isEditing.value = false

  const newMessage = {
    type: 'human',
    content: editValue.value,
  } as Message

  thread.submit(
    { messages: [newMessage] },
    {
      checkpoint: parentCheckpoint.value,
      streamMode: ['values'],
      multitaskStrategy: 'rollback',
      optimisticValues: (prev: Record<string, unknown>) => {
        const values = meta.value?.firstSeenState?.values
        if (!values || typeof values !== 'object') return prev

        const typedValues = values as Record<string, unknown>
        const existingMessages = Array.isArray(typedValues.messages)
          ? (typedValues.messages as Message[])
          : []

        return {
          ...typedValues,
          messages: [...existingMessages, newMessage],
        }
      },
    }
  )
}
</script>

<template>
  <div :class="['group ml-auto flex max-w-full min-w-0 items-center gap-2', isEditing && 'w-full max-w-xl']">
    <div :class="['flex max-w-full min-w-0 flex-col gap-2', isEditing && 'w-full']">
      <EditableContent
        v-if="isEditing"
        v-model="editValue"
        @submit="handleSubmitEdit"
      />

      <template v-else>
        <p
          v-if="!hasNonTextBlocks"
          class="max-w-full rounded-3xl bg-muted px-4 py-2 text-left text-sm break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
        >
          {{ contentString }}
        </p>
        <div
          v-else
          class="flex max-w-full min-w-0 flex-col items-end gap-2"
        >
          <ContentBlocks
            :blocks="contentBlocks"
            :hide-tool-calls="true"
          />
        </div>
      </template>

      <div
        :class="[
          'ml-auto flex items-center gap-2 transition-opacity',
          'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
          isEditing && 'opacity-100',
        ]"
      >
        <BranchSwitcher
          :branch="meta?.branch"
          :branch-options="meta?.branchOptions"
          :is-loading="isLoading"
          @select="(branch: string) => thread.setBranch(branch)"
        />

        <CommandBar
          v-model:isEditing="isEditing"
          :is-loading="isLoading"
          :content="contentString"
          @update:is-editing="handleSetIsEditing"
          :handleSubmitEdit="handleSubmitEdit"
          :is-human-message="true"
        />
      </div>
    </div>
  </div>
</template>
