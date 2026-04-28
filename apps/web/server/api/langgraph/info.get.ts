import { createError, defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  const res = await $fetch.raw(runtimeUrl('/info'), {
    headers: getRuntimeHeaders(),
  })

  if (!res.ok) {
    throw createError({
      statusCode: res.status,
      statusMessage: `LangGraph info request failed (${res.status})`,
    })
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res._data
  }

  return { ok: true }
})
