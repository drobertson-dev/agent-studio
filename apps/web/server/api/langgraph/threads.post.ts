import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  return runtimeFetch('/threads', { method: 'POST' })
})
