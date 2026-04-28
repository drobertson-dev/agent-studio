import { createError, defineEventHandler, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const threadId = getRouterParam(event, 'threadId')

  if (!threadId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing threadId' })
  }

  await runtimeFetch(`/threads/${threadId}`, { method: 'DELETE' })
  return { deleted: true }
})
