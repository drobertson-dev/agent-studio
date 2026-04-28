import { defineEventHandler, getQuery, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const threadId = getRouterParam(event, 'threadId')

  if (!threadId) {
    return []
  }

  const query = getQuery(event)
  const limitRaw = typeof query.limit === 'string' ? Number(query.limit) : undefined
  const limit = Number.isFinite(limitRaw) ? limitRaw : 5

  try {
    return await runtimeFetch(`/threads/${threadId}/history`, {
      query: { limit },
    })
  } catch {
    return []
  }
})
