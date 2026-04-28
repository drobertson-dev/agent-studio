<script setup lang="ts">
import type { Message, AIMessage, ToolMessage, UsageMetadata } from '@langchain/core/messages'
import type { Checkpoint } from '@langchain/langgraph'
import { getContentString } from '~/utils/getContentString'
import { getMessageContentBlocks } from '~/lib/messages/content-blocks'
import { cn } from '~/lib/utils'
import { useStream } from '#imports'
import { isAgentInboxInterruptSchema } from '@/lib/agent-inbox-interrupt'
import ToolResult from '~/components/thread/messages/ToolResult.vue'
import ContentBlocks from '~/components/thread/messages/ContentBlocks.vue'
import ToolCalls from '~/components/thread/messages/ToolCalls.vue'
import CustomComponent from '~/components/thread/messages/CustomComponent.vue'
import GenericInterruptView from '~/components/thread/messages/GenericInterruptView.vue'
import BranchSwitcher from '~/components/thread/messages/BranchSwitcher.vue'
import CommandBar from '~/components/thread/messages/CommandBar.vue'
import MessageUsage from '~/components/thread/messages/MessageUsage.vue'

const props = defineProps<{
  message: Message
  isLoading: boolean
  hideToolCalls?: boolean
}>()

const emit = defineEmits<{
  (e: 'regenerate', parentCheckpoint: Checkpoint | null | undefined): void
}>()

const hideToolCalls = computed(() => {
  return props.hideToolCalls === true
})

const { stream: thread } = useStream()

const isLastMessage = computed(() => {
  const messages = thread.messages || []
  return messages[messages.length - 1]?.id === props.message.id
})

const meta = computed(() => thread.getMessagesMetadata(props.message))
const interrupt = computed(() => thread.interrupt)
const parentCheckpoint = computed(() => meta.value?.firstSeenState?.parent_checkpoint)

const contentBlocks = computed(() => getMessageContentBlocks(props.message))

const contentString = computed(() => getContentString(props.message))

const usageMetadata = computed<UsageMetadata | undefined>(() => {
  const raw = (props.message as unknown as { usage_metadata?: unknown }).usage_metadata
  if (raw == null || typeof raw !== 'object') return undefined

  const maybe = raw as Partial<UsageMetadata>
  if (
    typeof maybe.input_tokens !== 'number' ||
    typeof maybe.output_tokens !== 'number' ||
    typeof maybe.total_tokens !== 'number'
  ) {
    return undefined
  }

  return maybe as UsageMetadata
})

const reasoningTokens = computed(() => usageMetadata.value?.output_token_details?.reasoning)

const hasToolCalls = computed(() => {
  return 'tool_calls' in props.message && (props.message as AIMessage).tool_calls?.length
})

const messageToolCalls = computed(() =>
  Array.isArray((props.message as AIMessage).tool_calls)
    ? ((props.message as AIMessage).tool_calls as unknown as Record<string, unknown>[])
    : []
)

const hasToolCallBlocks = computed(() =>
  contentBlocks.value.some(
    (block) =>
      block.type === 'tool_call' ||
      block.type === 'tool_call_chunk' ||
      block.type === 'server_tool_call' ||
      block.type === 'server_tool_call_chunk'
  )
)

const isToolResult = computed(() => props.message.type === 'tool')

const isAgentInboxInterrupt = computed(() => {
  if (!interrupt.value?.value) return false

  return isAgentInboxInterruptSchema(interrupt.value.value)
})

function handleRegenerate() {
  emit('regenerate', parentCheckpoint.value as Checkpoint | null | undefined)
}
</script>

<template>
  <div
    v-if="!isToolResult || !hideToolCalls"
    class="group mr-auto flex max-w-full min-w-0 items-start gap-2"
  >
    <ToolResult
      v-if="isToolResult"
      :message="message as ToolMessage"
    />

    <div
      v-else
      class="flex max-w-full min-w-0 flex-col gap-2"
    >
      <ContentBlocks
        v-if="contentBlocks.length"
        :blocks="contentBlocks"
        :hide-tool-calls="hideToolCalls"
        :reasoning-tokens="reasoningTokens"
        :tool-calls="messageToolCalls"
      />

      <template v-if="!hideToolCalls">
        <ToolCalls
          v-if="hasToolCalls && !hasToolCallBlocks"
          :tool-calls="messageToolCalls"
        />
      </template>

      <MessageUsage
        v-if="usageMetadata && !hideToolCalls"
        :usage="usageMetadata"
      />

      <CustomComponent
        :message="message"
        :thread="thread"
      />

      <!-- TODO: Add ThreadView -->
      <!-- <ThreadView
        v-if="isAgentInboxInterrupt && isLastMessage"
        :interrupt="interrupt.value"
      /> -->

      <GenericInterruptView
        v-if="interrupt?.value && !isAgentInboxInterrupt && isLastMessage"
        :interrupt="interrupt.value"
      />

      <div
        :class="
          cn(
            'mr-auto flex items-center gap-2 transition-opacity',
            'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
          )
        "
      >
        <BranchSwitcher
          :branch="meta?.branch"
          :branch-options="meta?.branchOptions"
          :is-loading="isLoading"
          @select="(branch: string) => thread.setBranch(branch)"
        />

        <CommandBar
          :content="contentString"
          :is-loading="isLoading"
          :is-ai-message="true"
          :handle-regenerate="handleRegenerate"
        />
      </div>
    </div>
  </div>
</template>
