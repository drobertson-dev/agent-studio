<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import NavUser from '@/components/NavUser.vue'
import type { Thread } from '@langchain/langgraph-sdk'
import { useThreads } from '~/composables/useThreads'

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: 'icon',
})

const data = {
  user: {
    name: 'Operator',
    email: 'Local studio',
    avatar: '/avatars/shadcn.jpg',
  },
}

const route = useRoute()
const router = useRouter()
const assistantId = computed(() => (route.query.assistantId as string | undefined) || 'agent')
const activeThreadId = computed(() => route.query.threadId as string | undefined)

const searchQuery = ref('')
const deletingThreadIds = ref(new Set<string>())
const threadPendingDelete = ref<Thread | null>(null)
const deleteDialogOpen = ref(false)
const deleteError = ref('')
let deleteDialogCleanupTimer: ReturnType<typeof setTimeout> | undefined
const { deleteThread, getThreads, threads, threadsLoading, threadsRefreshing } = useThreads()

const refreshThreads = async (options?: { background?: boolean }) => {
  if (!assistantId.value) return
  try {
    await getThreads(options)
  } catch (error) {
    console.error('Error fetching threads:', error)
  }
}

onMounted(() => {
  refreshThreads()
})

watch(assistantId, () => {
  refreshThreads()
})

const formatThreadDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const isSameDay = date.toDateString() === now.toDateString()
  const format = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isSameDay ? { hour: 'numeric', minute: 'numeric' } : {}),
  })
  return format.format(date)
}

const getThreadPreview = (thread: Thread) => {
  // Use extracted preview from server (via LangGraph extract parameter)
  const extracted = (thread as Record<string, unknown>).extracted as
    | { preview?: string }
    | undefined
  if (extracted?.preview && typeof extracted.preview === 'string') {
    return extracted.preview
  }

  // Fallback: try values if available (e.g. thread just created in this session)
  if (thread?.values && typeof thread.values === 'object' && 'messages' in thread.values) {
    const messages = (thread.values as { messages?: unknown }).messages
    if (Array.isArray(messages) && messages.length) {
      const firstHuman = (messages as Array<{ type?: string }>).find((m) => m.type === 'human')
      if (firstHuman) {
        const preview = getContentString(firstHuman)
        if (preview) return preview
      }
    }
  }

  return 'New thread'
}

const sortedThreads = computed(() => {
  return [...threads.value].sort((a, b) => {
    const aTime = new Date(a.updated_at).getTime()
    const bTime = new Date(b.updated_at).getTime()
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
  })
})

const filteredThreads = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return sortedThreads.value
  return sortedThreads.value.filter((thread) => {
    const preview = getThreadPreview(thread).toLowerCase()
    return preview.includes(query) || thread.thread_id.toLowerCase().includes(query)
  })
})

const handleThreadClick = (threadId: string) => {
  if (threadId === activeThreadId.value) return
  router.push({
    query: {
      ...route.query,
      threadId,
    },
  })
}

const handleNewThread = () => {
  const nextQuery = { ...route.query }
  delete (nextQuery as Record<string, unknown>).threadId
  router.push({ query: nextQuery })
}

const isDeletingThread = (threadId: string) => deletingThreadIds.value.has(threadId)
const pendingDeleteThreadId = computed(() => threadPendingDelete.value?.thread_id ?? '')
const isPendingDeleteInFlight = computed(
  () => !!pendingDeleteThreadId.value && isDeletingThread(pendingDeleteThreadId.value)
)

const setThreadDeleting = (threadId: string, deleting: boolean) => {
  const next = new Set(deletingThreadIds.value)
  if (deleting) {
    next.add(threadId)
  } else {
    next.delete(threadId)
  }
  deletingThreadIds.value = next
}

const handleDeleteThread = (thread: Thread) => {
  if (isDeletingThread(thread.thread_id)) return
  if (deleteDialogCleanupTimer) clearTimeout(deleteDialogCleanupTimer)
  deleteError.value = ''
  threadPendingDelete.value = thread
  deleteDialogOpen.value = true
}

const scheduleDeleteDialogCleanup = () => {
  if (deleteDialogCleanupTimer) clearTimeout(deleteDialogCleanupTimer)
  deleteDialogCleanupTimer = setTimeout(() => {
    if (!deleteDialogOpen.value) {
      threadPendingDelete.value = null
    }
  }, 220)
}

const closeDeleteDialog = () => {
  if (isPendingDeleteInFlight.value) return
  deleteDialogOpen.value = false
  deleteError.value = ''
  scheduleDeleteDialogCleanup()
}

const handleDeleteDialogOpenChange = (open: boolean) => {
  if (open) {
    deleteDialogOpen.value = true
    return
  }
  closeDeleteDialog()
}

const confirmDeleteThread = async () => {
  const thread = threadPendingDelete.value
  if (!thread || isDeletingThread(thread.thread_id)) return

  setThreadDeleting(thread.thread_id, true)
  deleteError.value = ''
  try {
    await deleteThread(thread.thread_id)
    if (thread.thread_id === activeThreadId.value) {
      const nextQuery = { ...route.query }
      delete (nextQuery as Record<string, unknown>).threadId
      await router.push({ query: nextQuery })
    }
    deleteDialogOpen.value = false
    scheduleDeleteDialogCleanup()
  } catch (error) {
    console.error('Error deleting thread:', error)
    deleteError.value = 'Could not delete this thread. Please try again.'
  } finally {
    setThreadDeleting(thread.thread_id, false)
  }
}

onBeforeUnmount(() => {
  if (deleteDialogCleanupTimer) clearTimeout(deleteDialogCleanupTimer)
})
</script>

<template>
  <Sidebar
    class="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
    v-bind="props"
  >
    <!-- This is the first sidebar -->
    <!-- We disable collapsible and adjust width to icon. -->
    <!-- This will make the sidebar appear as icons. -->
    <Sidebar
      collapsible="none"
      class="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              as-child
              class="md:h-8 md:p-0"
            >
              <NuxtLink to="#">
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Icon
                    name="lucide:blocks"
                    class="size-4"
                  />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-medium">Agent Studio</span>
                  <span class="truncate text-xs">Studio Agent</span>
                </div>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent />
      <SidebarFooter>
        <NavUser :user="data.user" />
      </SidebarFooter>
    </Sidebar>

    <!--  This is the second sidebar -->
    <!--  We disable collapsible and let it fill remaining space -->
    <Sidebar
      collapsible="none"
      class="hidden flex-1 md:flex"
    >
      <SidebarHeader class="gap-3.5 border-b p-4">
        <div class="flex w-full items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="text-base font-medium text-foreground">Threads</div>
            <div class="h-5">
              <div
                v-if="threadsRefreshing"
                class="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
              >
                <Icon
                  name="heroicons:arrow-path"
                  :size="14"
                  class="animate-spin"
                />
                Updating
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            @click="handleNewThread"
          >
            <Icon
              name="heroicons:pencil-square"
              :size="18"
            />
          </Button>
        </div>
        <SidebarInput
          v-model="searchQuery"
          placeholder="Search threads..."
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup class="px-0">
          <SidebarGroupContent>
            <div
              v-if="threadsLoading && threads.length === 0"
              class="flex w-full flex-col gap-2 p-4"
            >
              <Skeleton
                v-for="i in 12"
                :key="`thread-skeleton-${i}`"
                class="h-10 w-full"
              />
            </div>

            <div
              v-else-if="filteredThreads.length === 0"
              class="p-4 text-sm text-muted-foreground"
            >
              No threads yet.
            </div>

            <template v-else>
              <div
                v-for="thread in filteredThreads"
                :key="thread.thread_id"
                class="group/thread relative"
              >
                <NuxtLink
                  :to="{ query: { ...route.query, threadId: thread.thread_id } }"
                  class="flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight whitespace-nowrap last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  :class="
                    thread.thread_id === activeThreadId
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : ''
                  "
                  @click.prevent="handleThreadClick(thread.thread_id)"
                >
                  <div class="flex items-center gap-2">
                    <span class="max-w-62.5 truncate font-medium text-ellipsis">{{
                      getThreadPreview(thread)
                    }}</span>
                    <span class="ml-auto text-xs text-muted-foreground">
                      {{ formatThreadDate(thread.updated_at) }}
                    </span>
                  </div>
                  <span class="line-clamp-2 w-65 text-xs whitespace-break-spaces text-muted-foreground">
                    {{ thread.thread_id }}
                  </span>
                </NuxtLink>

                <button
                  type="button"
                  class="absolute right-4 bottom-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 group-hover/thread:opacity-100"
                  :aria-label="`Delete thread ${getThreadPreview(thread)}`"
                  :title="`Delete ${getThreadPreview(thread)}`"
                  :disabled="isDeletingThread(thread.thread_id)"
                  @click.stop.prevent="handleDeleteThread(thread)"
                >
                  <Icon
                    v-if="isDeletingThread(thread.thread_id)"
                    name="heroicons:arrow-path"
                    :size="16"
                    class="animate-spin"
                  />
                  <Icon
                    v-else
                    name="lucide:trash-2"
                    :size="16"
                  />
                </button>
              </div>
            </template>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>

    <Dialog
      :open="deleteDialogOpen"
      @update:open="handleDeleteDialogOpenChange"
    >
      <DialogContent
        class="max-w-md p-5"
        :show-close="!isPendingDeleteInFlight"
      >
        <DialogHeader class="text-left">
          <div class="flex items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Icon
                name="lucide:trash-2"
                :size="20"
              />
            </div>
            <div class="min-w-0">
              <DialogTitle class="text-base">
                Delete thread?
              </DialogTitle>
              <DialogDescription class="mt-1">
                This removes the conversation from the thread list. This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="min-w-0 overflow-hidden rounded-md border bg-muted/30 p-3">
          <div class="break-all font-mono text-xs text-muted-foreground">
            {{ pendingDeleteThreadId }}
          </div>
        </div>

        <p
          v-if="deleteError"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {{ deleteError }}
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            :disabled="isPendingDeleteInFlight"
            @click="closeDeleteDialog"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            :disabled="isPendingDeleteInFlight"
            @click="confirmDeleteThread"
          >
            <Icon
              v-if="isPendingDeleteInFlight"
              name="heroicons:arrow-path"
              :size="16"
              class="animate-spin"
            />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Sidebar>
</template>
