<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { Button } from '~/components/ui/button'

interface Props {
  tooltip: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  class?: string
  disabled?: boolean
}

const { side = 'bottom', tooltip, variant = 'ghost', size = 'icon', ...rest } = defineProps<Props>()
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          :variant="variant"
          :size="size"
          class="size-6 p-1"
          v-bind="rest"
          @click="$emit('click', $event)"
        >
          <slot />
          <span class="sr-only">{{ tooltip }}</span>
        </Button>
      </TooltipTrigger>

      <TooltipContent :side="side">{{ tooltip }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
