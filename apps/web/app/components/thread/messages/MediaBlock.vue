<script setup lang="ts">
import type { ContentBlock } from '~/lib/messages/content-blocks'

const props = defineProps<{
  block: ContentBlock
}>()

const toBase64 = (data: Uint8Array) => {
  let binary = ''
  data.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

const resolveDataUrl = (block: ContentBlock) => {
  const mimeType =
    typeof block.mimeType === 'string'
      ? block.mimeType
      : typeof block.mime_type === 'string'
        ? block.mime_type
        : 'application/octet-stream'

  const rawData = block.data ?? block.base64

  if (typeof rawData === 'string') {
    if (rawData.startsWith('data:')) return rawData
    return `data:${mimeType};base64,${rawData}`
  }

  if (rawData instanceof Uint8Array) {
    return `data:${mimeType};base64,${toBase64(rawData)}`
  }

  if (Array.isArray(rawData)) {
    return `data:${mimeType};base64,${toBase64(new Uint8Array(rawData))}`
  }

  return undefined
}

const src = computed(() => {
  if (typeof props.block.url === 'string') return props.block.url
  if (typeof props.block.fileId === 'string') return undefined
  if (typeof props.block.id === 'string') return undefined
  return resolveDataUrl(props.block)
})

const label = computed(() => {
  if (typeof props.block.title === 'string') return props.block.title
  if (typeof props.block.fileId === 'string') return props.block.fileId
  if (typeof props.block.id === 'string') return props.block.id
  return 'Attachment'
})

const mediaMimeType = computed(() => {
  if (typeof props.block.mimeType === 'string') return props.block.mimeType
  if (typeof props.block.mime_type === 'string') return props.block.mime_type
  return undefined
})
</script>

<template>
  <div class="rounded-md border bg-muted/30 p-3">
    <template v-if="block.type === 'image'">
      <img
        v-if="src"
        :src="src"
        :alt="label"
        class="max-h-96 w-auto rounded-md"
      />
      <p
        v-else
        class="text-sm text-muted-foreground"
      >
        Image attachment ({{ label }})
      </p>
    </template>

    <template v-else-if="block.type === 'video'">
      <video
        v-if="src"
        class="w-full rounded-md"
        controls
      >
        <source
          :src="src"
          :type="mediaMimeType"
        />
      </video>
      <p
        v-else
        class="text-sm text-muted-foreground"
      >
        Video attachment ({{ label }})
      </p>
    </template>

    <template v-else-if="block.type === 'audio'">
      <audio
        v-if="src"
        class="w-full"
        controls
      >
        <source
          :src="src"
          :type="mediaMimeType"
        />
      </audio>
      <p
        v-else
        class="text-sm text-muted-foreground"
      >
        Audio attachment ({{ label }})
      </p>
    </template>

    <template v-else-if="block.type === 'text-plain'">
      <p class="text-xs font-semibold text-muted-foreground uppercase">File Preview</p>
      <p class="mt-2 text-sm whitespace-pre-wrap">
        {{ block.text ?? '' }}
      </p>
    </template>

    <template v-else>
      <p class="text-xs font-semibold text-muted-foreground uppercase">File</p>
      <a
        v-if="src"
        :href="src"
        target="_blank"
        rel="noreferrer"
        class="mt-2 inline-flex items-center text-sm underline"
      >
        {{ label }}
      </a>
      <p
        v-else
        class="mt-2 text-sm text-muted-foreground"
      >
        {{ label }}
      </p>
    </template>
  </div>
</template>
