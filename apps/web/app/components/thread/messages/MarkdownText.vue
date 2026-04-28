<!--suppress CssUnresolvedCustomProperty -->
<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{
  content: string
}>()

const VIDEO_EXTS = /\.(mp4|webm|mov)(\?|$)/i
const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i

function isVideoUrl(href: string): boolean {
  try {
    const pathname = new URL(href, 'https://x').pathname
    return VIDEO_EXTS.test(pathname)
  } catch {
    return VIDEO_EXTS.test(href)
  }
}

function isImageUrl(href: string): boolean {
  try {
    const pathname = new URL(href, 'https://x').pathname
    return IMAGE_EXTS.test(pathname)
  } catch {
    return IMAGE_EXTS.test(href)
  }
}

const renderer = new marked.Renderer()

// Intercept links — render video/image inline instead of <a>
renderer.link = ({
  href,
  text,
}: {
  href: string
  tokens?: unknown
  text?: string
  title?: string | null
}) => {
  if (!href) return `<a href="">${text ?? ''}</a>`
  if (isVideoUrl(href)) {
    return `<video controls class="inline-media inline-video" src="${href}" title="${text || ''}">Your browser does not support video.</video>`
  }
  if (isImageUrl(href)) {
    return `<img class="inline-media inline-image" src="${href}" alt="${text || ''}" loading="lazy" />`
  }
  return `<a href="${href}" target="_blank" rel="noreferrer">${text ?? href}</a>`
}

// Wrap tables in a scrollable container
const defaultTable = renderer.table.bind(renderer)
renderer.table = (token: Parameters<typeof renderer.table>[0]) => {
  const inner = defaultTable(token)
  return `<div class="table-scroll-wrapper">${inner}</div>`
}

// Intercept images — ensure they render with our styling
renderer.image = ({ href, text }: { href: string; title?: string | null; text?: string }) => {
  if (!href) return ''
  if (isVideoUrl(href)) {
    return `<video controls class="inline-media inline-video" src="${href}" title="${text || ''}">Your browser does not support video.</video>`
  }
  return `<img class="inline-media inline-image" src="${href}" alt="${text || ''}" loading="lazy" />`
}

// Allow media elements through DOMPurify
const PURIFY_CONFIG = {
  ADD_TAGS: ['video', 'source', 'img'],
  ADD_ATTR: [
    'controls',
    'src',
    'alt',
    'loading',
    'title',
    'class',
    'type',
    'autoplay',
    'muted',
    'loop',
    'playsinline',
  ],
}

const renderedMarkdown = computed(() => {
  if (!props.content) return ''
  const html = marked.parse(props.content, { breaks: true, renderer })
  return DOMPurify.sanitize(html as string, PURIFY_CONFIG)
})
</script>

<template>
  <div
    v-html="renderedMarkdown"
    class="markdown-text"
  />
</template>

<style scoped>
.markdown-text {
  max-width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: normal;
  overflow: hidden;
}

.markdown-text :deep(pre) {
  padding: 1rem;
  border-radius: 0.375rem;
  background-color: rgb(var(--color-muted-rgb) / 0.5);
  max-width: 100%;
  overflow-x: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.markdown-text :deep(code) {
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  background-color: rgb(var(--color-muted-rgb) / 0.5);
  font-family: monospace;
  overflow-wrap: anywhere;
  word-break: normal;
}

.markdown-text :deep(pre code) {
  padding: 0;
  background-color: transparent;
}

.markdown-text :deep(a) {
  color: rgb(var(--color-primary-rgb));
  text-decoration: underline;
}

.markdown-text :deep(.inline-media) {
  display: block;
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 0.75rem 0;
}

.markdown-text :deep(.inline-video) {
  max-height: 480px;
  width: auto;
  max-width: 100%;
  background: #000;
}

.markdown-text :deep(.inline-image) {
  max-height: 512px;
  width: auto;
  max-width: 100%;
}

.markdown-text :deep(ul),
.markdown-text :deep(ol) {
  padding-left: 1.5rem;
}

.markdown-text :deep(ul) {
  list-style-type: disc;
}

.markdown-text :deep(ol) {
  list-style-type: decimal;
}

.markdown-text :deep(h1),
.markdown-text :deep(h2),
.markdown-text :deep(h3),
.markdown-text :deep(h4),
.markdown-text :deep(h5),
.markdown-text :deep(h6) {
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.markdown-text :deep(.table-scroll-wrapper) {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  margin: 0.75rem 0;
  border-radius: 0.375rem;
  border: 1px solid var(--border);
}

.markdown-text :deep(table) {
  border-collapse: collapse;
  font-size: 0.875rem;
  table-layout: auto;
  white-space: nowrap;
  width: max-content;
  min-width: 100%;
}

.markdown-text :deep(th),
.markdown-text :deep(td) {
  border: 1px solid var(--border);
  padding: 0.5rem 0.75rem;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: normal;
}

.markdown-text :deep(td:last-child) {
  white-space: normal;
  min-width: 12rem;
  max-width: 28rem;
  overflow-wrap: break-word;
}

.markdown-text :deep(th) {
  font-weight: 600;
  background-color: var(--muted);
}

.markdown-text :deep(tr:nth-child(even)) {
  background-color: color-mix(in oklch, var(--muted) 30%, transparent);
}

.markdown-text :deep(p) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.markdown-text :deep(blockquote) {
  border-left: 3px solid var(--border);
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: var(--muted-foreground);
}

.markdown-text :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1rem 0;
}
</style>
