<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router'
import { getContentString } from '~/utils/getContentString'

interface Thread {
  thread_id: string
  values: Record<string, unknown> | null
}

const isLargeScreen = useMediaQuery('(min-width: 1024px)')
const threadId = useRouteQuery('threadId')
const chatHistoryOpen = useRouteQuery('chatHistoryOpen', 'false', {
  transform: {
    get: (val: string) => val === 'true',
    set: (val: boolean) => (val ? 'true' : 'false'),
  },
})

const { getThreads, threads, threadsLoading } = useThreads()

onMounted(async () => {
  try {
    await getThreads()
  } catch (error) {
    console.error(error)
  }
})

const updateChatHistoryOpen = (open: boolean) => {
  if (isLargeScreen.value) return
  chatHistoryOpen.value = open
}

const handleThreadClick = (thread: Thread) => {
  if (thread.thread_id === threadId.value) return
  threadId.value = thread.thread_id
}

const handleMobileThreadClick = (thread: Thread) => {
  handleThreadClick(thread)
  chatHistoryOpen.value = false
}

const getDisplayText = (thread: Thread): string => {
  let itemText = thread.thread_id
  const values = thread.values
  if (values && typeof values === 'object' && 'messages' in values) {
    const messages = (values as { messages?: unknown }).messages
    if (Array.isArray(messages) && messages.length > 0) {
      const firstMessage = messages[0] as { content?: unknown }
      itemText = getContentString(firstMessage.content)
    }
  }
  return itemText
}
</script>

<template>
  <div
    class="shadow-inner-right hidden h-screen w-75 shrink-0 flex-col items-start justify-start gap-6 border-r border-slate-300 lg:flex"
  >
    <div class="flex w-full items-center justify-between px-4 pt-1.5">
      <Button
        class="hover:bg-gray-100"
        variant="ghost"
        @click="chatHistoryOpen = !chatHistoryOpen"
      >
        <Icon
          name="lucide:panel-right-open"
          v-if="chatHistoryOpen"
          class="size-5"
        />
        <Icon
          name="lucide:panel-right-close"
          v-else
          class="size-5"
        />
      </Button>
      <h1 class="text-xl font-semibold tracking-tight">Thread History</h1>
    </div>

    <div
      v-if="threadsLoading"
      class="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent"
    >
      <Skeleton
        v-for="i in 30"
        :key="'skeleton-' + i"
        class="h-10 w-70"
      />
    </div>

    <div
      v-else
      class="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent"
    >
      <div
        v-for="t in threads"
        :key="t.thread_id"
        class="w-full px-1"
      >
        <Button
          variant="ghost"
          class="w-70 items-start justify-start text-left font-normal"
          @click="handleThreadClick(t)"
        >
          <p class="truncate text-ellipsis">
            {{ getDisplayText(t) }}
          </p>
        </Button>
      </div>
    </div>
  </div>

  <div class="lg:hidden">
    <Sheet
      :open="chatHistoryOpen && !isLargeScreen"
      @update:open="updateChatHistoryOpen"
    >
      <SheetContent
        side="left"
        class="flex lg:hidden"
      >
        <SheetHeader>
          <SheetTitle>Thread History</SheetTitle>
        </SheetHeader>
        <div
          class="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          <div
            v-for="t in threads"
            :key="t.thread_id"
            class="w-full px-1"
          >
            <Button
              variant="ghost"
              class="w-70 items-start justify-start text-left font-normal"
              @click="handleMobileThreadClick(t)"
            >
              <p class="truncate text-ellipsis">
                {{ getDisplayText(t) }}
              </p>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
