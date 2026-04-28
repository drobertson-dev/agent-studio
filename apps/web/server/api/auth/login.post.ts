import { createError, defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ password?: string }>(event)
  const config = useRuntimeConfig()
  const expected = config.STUDIO_PASSWORD || process.env.STUDIO_PASSWORD || 'agent-studio'

  if (!body?.password || body.password !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid password' })
  }

  setAuthenticated(event)
  return { authenticated: true }
})
