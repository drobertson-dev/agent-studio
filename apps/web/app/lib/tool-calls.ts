export type ToolCallLike = Record<string, unknown>

export type NormalizedToolCall = {
  id: string
  name: string
  args: unknown
  type: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isEmptyArgs = (value: unknown): boolean => {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (isRecord(value)) return Object.keys(value).length === 0
  return false
}

const parseJsonString = (value: string): unknown => {
  const trimmed = value.trim()
  if (!trimmed) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

export function getToolCallId(toolCall: ToolCallLike): string {
  return String(
    toolCall.id ?? toolCall.callId ?? toolCall.toolCallId ?? toolCall.tool_call_id ?? ''
  )
}

export function getToolCallName(toolCall: ToolCallLike): string {
  const functionValue = isRecord(toolCall.function) ? toolCall.function : undefined
  return String(toolCall.name ?? toolCall.tool_name ?? functionValue?.name ?? 'tool')
}

function getRawToolArgs(toolCall: ToolCallLike): unknown {
  const functionValue = isRecord(toolCall.function) ? toolCall.function : undefined
  return (
    toolCall.args ??
    toolCall.arguments ??
    toolCall.input ??
    toolCall.tool_input ??
    functionValue?.arguments
  )
}

function getMeaningfulToolArgs(toolCall: ToolCallLike): unknown {
  const raw = getRawToolArgs(toolCall)
  if (isEmptyArgs(raw)) return undefined
  return typeof raw === 'string' ? parseJsonString(raw) : raw
}

function isSameToolCall(toolCall: ToolCallLike, candidate: ToolCallLike): boolean {
  const id = getToolCallId(toolCall)
  const candidateId = getToolCallId(candidate)
  if (id && candidateId) return id === candidateId
  return getToolCallName(toolCall) === getToolCallName(candidate)
}

export function normalizeToolCall(
  toolCall: ToolCallLike,
  fallbackToolCalls: ToolCallLike[] = []
): NormalizedToolCall {
  const fallback = fallbackToolCalls.find((candidate) => isSameToolCall(toolCall, candidate))
  const args =
    getMeaningfulToolArgs(toolCall) ??
    (fallback ? getMeaningfulToolArgs(fallback) : undefined) ??
    getRawToolArgs(toolCall) ??
    (fallback ? getRawToolArgs(fallback) : undefined) ??
    {}

  return {
    id: getToolCallId(toolCall) || (fallback ? getToolCallId(fallback) : ''),
    name: getToolCallName(toolCall) || (fallback ? getToolCallName(fallback) : 'tool'),
    args: typeof args === 'string' ? parseJsonString(args) : args,
    type: String(toolCall.type ?? fallback?.type ?? 'tool_call'),
  }
}

export function getToolArgsCount(args: unknown): number {
  if (isEmptyArgs(args)) return 0
  if (typeof args === 'string') return getToolArgsCount(parseJsonString(args))
  if (Array.isArray(args)) return args.length
  if (isRecord(args)) return Object.keys(args).length
  return 1
}

export function formatToolArgs(args: unknown): string {
  const value = typeof args === 'string' ? parseJsonString(args) : args
  if (value == null) return '{}'
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
