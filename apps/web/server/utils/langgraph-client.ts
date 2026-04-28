import { createError } from 'h3'

type RuntimeFetchOptions = Parameters<typeof $fetch>[1]

export function getRuntimeApiUrl(): string {
  const config = useRuntimeConfig()
  const apiUrl = config.LANGGRAPH_API_URL || process.env.LANGGRAPH_API_URL

  if (!apiUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Runtime API URL is not configured on the server',
    })
  }

  return apiUrl.replace(/\/+$/, '')
}

export function getRuntimeHeaders(): Record<string, string> | undefined {
  const config = useRuntimeConfig()
  const apiKey = config.LANGGRAPH_API_KEY || process.env.LANGGRAPH_API_KEY

  return apiKey ? { 'x-api-key': apiKey } : undefined
}

export function runtimeUrl(path: string): string {
  return `${getRuntimeApiUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

export async function runtimeFetch<T>(path: string, options?: RuntimeFetchOptions): Promise<T> {
  return $fetch<T>(runtimeUrl(path), {
    ...options,
    headers: {
      ...getRuntimeHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
  })
}
