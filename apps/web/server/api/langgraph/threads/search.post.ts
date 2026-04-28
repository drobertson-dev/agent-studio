import { defineEventHandler, readBody } from 'h3'

/**
 * Search threads with lightweight responses using select + extract.
 *
 * `select` returns only metadata fields (no full state).
 * `extract` pulls the first human message content via JSON path,
 * returned under `extracted.preview` on each thread.
 *
 * Result: ~5 KB / 0.14s instead of ~30 MB / 90s.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown> | undefined>(event)

  const searchParams = {
    ...(body ?? {}),
    select: ['thread_id', 'created_at', 'updated_at', 'metadata', 'status'],
    extract: { preview: 'values.messages[0].content' },
  }

  try {
    return await runtimeFetch('/threads/search', { method: 'POST', body: searchParams })
  } catch (error) {
    console.error('[threads/search] Error:', error instanceof Error ? error.message : error)
    return []
  }
})
