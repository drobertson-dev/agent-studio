<script setup lang="ts">
definePageMeta({
  pageTransition: false,
  layoutTransition: false,
})

import AppSidebar from '@/components/AppSidebar.vue'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const password = ref('')
const authLoading = ref(true)
const loginLoading = ref(false)
const authError = ref('')
const authenticated = ref(false)

const mainContainerClasses = computed(() =>
  cn(
    'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
    'hide-scrollbar grid-rows-[1fr]'
  )
)

onMounted(async () => {
  try {
    const session = await $fetch<{ authenticated: boolean }>('/api/auth/session')
    authenticated.value = session.authenticated
  } finally {
    authLoading.value = false
  }
})

const login = async () => {
  if (!password.value || loginLoading.value) return
  authError.value = ''
  loginLoading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { password: password.value },
    })
    authenticated.value = true
    password.value = ''
  } catch {
    authError.value = 'Invalid password'
  } finally {
    loginLoading.value = false
  }
}
</script>

<template>
  <div
    v-if="authLoading"
    class="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground"
  >
    Loading...
  </div>

  <div
    v-else-if="!authenticated"
    class="flex min-h-screen items-center justify-center bg-background p-4"
  >
    <form
      class="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm"
      @submit.prevent="login"
    >
      <div class="mb-6 flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icon
            name="lucide:blocks"
            :size="22"
          />
        </div>
        <div>
          <h1 class="text-lg font-semibold tracking-tight">Agent Studio</h1>
          <p class="text-sm text-muted-foreground">Studio access</p>
        </div>
      </div>

      <Label for="password">Password</Label>
      <Input
        id="password"
        v-model="password"
        class="mt-2"
        type="password"
        autocomplete="current-password"
      />
      <p
        v-if="authError"
        class="mt-2 text-sm text-destructive"
      >
        {{ authError }}
      </p>

      <Button
        class="mt-5 w-full"
        type="submit"
        :disabled="loginLoading || !password"
      >
        <Icon
          v-if="loginLoading"
          name="lucide:loader-circle"
          :size="16"
          class="animate-spin"
        />
        Enter
      </Button>
    </form>
  </div>

  <div v-else>
    <SidebarProvider
      :style="{
        '--sidebar-width': '425px',
      }"
    >
      <AppSidebar />
      <SidebarInset>
        <header class="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b bg-background p-4">
          <SidebarTrigger class="-ml-1" />
          <Separator
            orientation="vertical"
            class="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem class="hidden md:block">
                <BreadcrumbLink href="#"> Agent Studio </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator class="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Studio Agent</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div class="flex h-full w-full overflow-hidden">
          <div :class="mainContainerClasses">
            <StreamProvider>
              <Thread />
            </StreamProvider>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  </div>
</template>
