export const DEFAULT_ASSISTANT_ID = 'agent'

export const STARTER_PROMPT =
  "Create a first Agent Studio project: publish a polished static welcome site under /workspace/sites/starter, add a simple JSON health endpoint under /workspace/api/health.py, then tell me the URLs to try and what files you changed."

export function hideToolCallsFromShowPreference(showToolCalls: boolean) {
  return !showToolCalls
}
