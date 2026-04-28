<script lang="ts" setup>
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'vue-sonner'
import { useRouteQuery } from '@vueuse/router'
import type { Checkpoint } from '@langchain/langgraph'
import type { Message } from '@langchain/core/messages'
import { cn } from '~/lib/utils'
import { ensureToolCallsHaveResponses } from '~/lib/ensure-tool-responses'
import { DO_NOT_RENDER_ID_PREFIX } from '~/lib/ensure-tool-responses'
import HumanMessage from '~/components/thread/messages/HumanMessage.vue'
import AssistantMessage from '~/components/thread/messages/AssistantMessage.vue'
import AssistantMessageLoading from '~/components/thread/messages/AssistantMessageLoading.vue'
import ScrollToBottom from '~/components/thread/ScrollToBottom.vue'
import { STARTER_PROMPT, hideToolCallsFromShowPreference } from '~/lib/studio-starter'
import { shouldRenderMessage } from '~/lib/tool-visibility'

type ComposerTextarea = {
  focus: () => void
  select: () => void
}

const route = useRoute()

const hideToolCalls = useRouteQuery('hideToolCalls', 'false', {
  transform: {
    get: (val: string) => val === 'true',
    set: (val: boolean) => (val ? 'true' : 'false'),
  },
})
const showToolCalls = computed({
  get: () => !hideToolCalls.value,
  set: (value: boolean) => {
    hideToolCalls.value = hideToolCallsFromShowPreference(value)
  },
})

const input = ref('')
const composerRef = ref<ComposerTextarea | null>(null)
const firstTokenReceived = ref(false)
const lastError = ref<string | undefined>(undefined)

const threadId = computed({
  get: () => route.query.threadId as string | undefined,
  set: async (value: string | undefined) => {
    const newQuery = { ...route.query }
    if (value) {
      newQuery.threadId = value
    } else {
      delete newQuery.threadId
    }
    await navigateTo({ query: newQuery })
  },
})

const { stream } = useStream()

const messages = computed(() => stream.messages)
const isLoading = computed(() => stream.isLoading)
const prevMessageLength = ref(0)
const starterPromptPrefilled = ref(false)

const chatStarted = computed(() => {
  return !!threadId.value || !!messages.value.length
})

const filteredMessages = computed(() => {
  const visibleMessages = messages.value.filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
  if (!hideToolCalls.value) return visibleMessages
  return visibleMessages.filter((m) => shouldRenderMessage(m, true))
})

const observerContainerClasses = computed(() =>
  cn(
    'absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent',
    !chatStarted.value && 'mt-[25vh] flex flex-col items-stretch',
    chatStarted.value && 'grid grid-rows-[1fr_auto]'
  )
)

const handleRegenerate = (parentCheckpoint: Checkpoint | null | undefined) => {
  // Do this so the loading state is correct
  prevMessageLength.value = prevMessageLength.value - 1
  firstTokenReceived.value = false
  stream.submit(undefined, {
    checkpoint: parentCheckpoint,
    streamMode: ['values'],
    multitaskStrategy: 'rollback',
  })
}

const submitText = (content: string) => {
  if (!content.trim()) return

  const newHumanMessage: Message = {
    id: uuidv4(),
    type: 'human',
    content,
  }

  const toolMessages = ensureToolCallsHaveResponses(stream.messages)

  stream.submit(
    { messages: [...toolMessages, newHumanMessage] },
    {
      streamMode: ['values'],
      multitaskStrategy: 'rollback',
      optimisticValues: (prev) => ({
        ...prev,
        messages: [...(prev.messages ?? []), newHumanMessage],
      }),
    }
  )
}

const handleSubmit = () => {
  if (!input.value.trim()) return

  starterPromptPrefilled.value = false
  submitText(input.value)
  input.value = ''
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
    e.preventDefault()
    const el = e.target as HTMLElement | undefined
    const form = el?.closest('form')
    form?.requestSubmit()
  }
}

const selectComposerInput = async () => {
  await nextTick()
  if (!import.meta.client) return

  requestAnimationFrame(() => {
    composerRef.value?.focus()
    composerRef.value?.select()
  })
}

const prefillStarterPrompt = async () => {
  if (threadId.value || messages.value.length > 0 || isLoading.value || starterPromptPrefilled.value) {
    return
  }

  input.value = STARTER_PROMPT
  starterPromptPrefilled.value = true
  await selectComposerInput()
}

watch(
  () => stream.error,
  (error) => {
    if (!stream.error) {
      lastError.value = undefined
      return
    }

    const message = stream.error?.message
    if (!message || lastError.value === message) {
      // Message has already been logged. do not modify ref, return early.
      return
    }

    // Message is defined, and it has not been logged yet. Save it, and send the error
    lastError.value = message

    toast.error('An error occurred. Please try again.', {
      description: `
      <p>
        <strong>Error:</strong> <code>${message}</code>
      </p>
    `,
      richColors: true,
      closeButton: true,
    })
  }
)

watch(
  () => messages.value,
  (val) => {
    if (
      val.length !== prevMessageLength.value &&
      val?.length &&
      val[val.length - 1].type === 'ai'
    ) {
      firstTokenReceived.value = true
    }

    prevMessageLength.value = val.length
  },
  {
    immediate: true,
  }
)

watch(threadId, async (currentThreadId) => {
  starterPromptPrefilled.value = false
  if (currentThreadId) {
    if (input.value === STARTER_PROMPT) input.value = ''
    return
  }
  if (!currentThreadId) {
    await prefillStarterPrompt()
  }
})

watch(
  () => [threadId.value, messages.value.length, isLoading.value] as const,
  async ([currentThreadId, messageCount, loading]) => {
    if (currentThreadId || messageCount > 0 || loading) {
      return
    }
    await prefillStarterPrompt()
  },
  { immediate: true, flush: 'post' }
)
</script>

<template>
  <div class="hide-scrollbar relative flex-1 overflow-hidden">
    <ObserverContainer
      style="width: 100%; height: 100%"
      :class="observerContainerClasses"
    >
      <template #default="{ isAtBottom, scrollToBottom }">
        <div class="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 px-4 pt-8 pb-16">
          <template
            v-for="(message, index) in filteredMessages"
            :key="message.id || `${message.type}-${index}`"
          >
            <HumanMessage
              v-if="message.type === 'human'"
              :message="message"
              :isLoading="isLoading"
            />

            <AssistantMessage
              v-else
              :message="message"
              :isLoading="isLoading"
              :hide-tool-calls="hideToolCalls"
              @regenerate="handleRegenerate"
            />
          </template>

          <AssistantMessageLoading v-if="isLoading && !firstTokenReceived" />
        </div>

        <div class="sticky bottom-0 flex flex-col items-center gap-8 px-4">
          <div
            v-if="!chatStarted"
            class="flex flex-col items-center gap-3 text-center"
          >
            <h1 class="text-2xl font-semibold tracking-tight">Agent Studio</h1>
            <p class="max-w-xl text-sm leading-6 text-muted-foreground">
              Build sites, dashboards, API routes, and specialized agents from one deployed workspace.
            </p>
          </div>

          <ScrollToBottom
            v-show="!isAtBottom"
            class="absolute bottom-full left-1/2 mb-4 -translate-x-1/2 animate-in fade-in-0 zoom-in-95"
            @click="scrollToBottom"
          />

          <div class="relative z-10 mx-auto mb-8 w-full max-w-5xl min-w-0 rounded-2xl border bg-muted shadow-xs">
            <form
              @submit.prevent="handleSubmit"
              class="mx-auto grid max-w-5xl grid-rows-[1fr_auto] gap-2"
            >
              <Textarea
                ref="composerRef"
                v-model="input"
                @keydown="handleKeydown"
                placeholder="Type your message..."
                class="field-sizing-content resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 outline-none focus:ring-0 focus:outline-none"
              />

              <div class="flex items-center justify-between p-2 pt-4">
                <div class="flex flex-wrap items-center gap-3">
                  <div class="flex items-center space-x-2">
                    <Switch
                      id="show-tool-calls"
                      v-model="showToolCalls"
                    />
                    <Label for="show-tool-calls"> Tool Calls </Label>
                  </div>
                </div>

                <Button
                  v-if="stream.isLoading"
                  key="stop"
                  @click="stream.stop()"
                >
                  <Icon
                    name="heroicons:arrow-path"
                    :size="16"
                    class="animate-spin"
                  />
                  Cancel
                </Button>

                <Button
                  v-else
                  type="submit"
                  :disabled="isLoading || !input.trim()"
                >
                  <Icon
                    name="lucide:send"
                    :size="16"
                  />
                  Send
                </Button>
              </div>
            </form>
          </div>
        </div>
      </template>
    </ObserverContainer>
  </div>
</template>
