<script lang="ts" setup>
const emit = defineEmits<{
  (e: 'select', branch: string): void
}>()

const { branch, branchOptions, isLoading } = defineProps<{
  branch: string | undefined
  branchOptions: string[] | undefined
  isLoading: boolean
}>()

const hasBranch = computed(() => branchOptions && branch)

const index = computed(() => (branchOptions ?? []).indexOf(branch ?? ''))

const selectBranch = (item?: string) => {
  if (!item) return

  emit('select', item)
}
</script>

<template>
  <div
    v-if="hasBranch"
    class="flex items-center gap-2"
  >
    <Button
      variant="ghost"
      size="icon"
      class="size-6 p-1"
      @click="selectBranch(branchOptions?.[index - 1])"
      :disabled="isLoading"
    >
      <Icon name="lucide:chevron-left" />
    </Button>

    <span class="text-sm"> {{ index + 1 }} / {{ branchOptions?.length }} </span>

    <Button
      variant="ghost"
      size="icon"
      class="size-6 p-1"
      @click="selectBranch(branchOptions?.[index + 1])"
      :disabled="isLoading"
    >
      <Icon name="lucide:chevron-right" />
    </Button>
  </div>
</template>
