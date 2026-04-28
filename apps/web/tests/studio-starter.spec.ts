import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ASSISTANT_ID,
  STARTER_PROMPT,
  hideToolCallsFromShowPreference,
} from '../app/lib/studio-starter'
import {
  getVisibleContentBlocks,
  isToolContentBlock,
  shouldRenderMessage,
} from '../app/lib/tool-visibility'
import {
  formatToolArgs,
  getToolArgsCount,
  normalizeToolCall,
} from '../app/lib/tool-calls'

describe('Agent Studio UI helpers', () => {
  it('uses the LangGraph agent graph by default', () => {
    expect(DEFAULT_ASSISTANT_ID).toBe('agent')
  })

  it('builds a starter prompt for the builder-host workflow', () => {
    expect(STARTER_PROMPT).toContain('/workspace/sites/starter')
    expect(STARTER_PROMPT).toContain('/workspace/api/health.py')
    expect(STARTER_PROMPT).toContain('URLs to try')
    expect(STARTER_PROMPT).not.toContain('odds')
    expect(STARTER_PROMPT).not.toContain('BetStamp')
  })

  it('maps the visible tool-call switch to the legacy hide query flag', () => {
    expect(hideToolCallsFromShowPreference(true)).toBe(false)
    expect(hideToolCallsFromShowPreference(false)).toBe(true)
  })

  it('hides tool messages and tool-only assistant messages', () => {
    expect(shouldRenderMessage({ type: 'tool', content: 'result' }, true)).toBe(false)
    expect(
      shouldRenderMessage(
        {
          type: 'ai',
          content: [{ type: 'tool_call', name: 'runtime_status' }],
          tool_calls: [{ name: 'runtime_status' }],
        },
        true
      )
    ).toBe(false)
    expect(
      shouldRenderMessage(
        {
          type: 'ai',
          content: 'Here is the briefing.',
          tool_calls: [{ name: 'runtime_status' }],
        },
        true
      )
    ).toBe(true)
  })

  it('filters all tool content block variants when traces are hidden', () => {
    expect(isToolContentBlock({ type: 'server_tool_call_result' })).toBe(true)
    expect(isToolContentBlock({ type: 'tool_result' })).toBe(true)

    const visible = getVisibleContentBlocks(
      [
        { type: 'text', text: 'visible' },
        { type: 'tool_call', name: 'runtime_status' },
        { type: 'server_tool_call_result', content: 'hidden' },
      ],
      true
    )

    expect(visible).toEqual([{ type: 'text', text: 'visible' }])
  })

  it('fills content-block tool-call args from message-level tool calls', () => {
    const call = normalizeToolCall(
      { type: 'tool_call', id: 'call-1', name: 'runtime_status', args: {} },
      [
        {
          id: 'call-1',
          name: 'runtime_status',
          args: {
            workspace_root: '/workspace',
            site_url_pattern: 'https://<site-name>.<site-domain-suffix>/',
          },
        },
      ]
    )

    expect(getToolArgsCount(call.args)).toBe(2)
    expect(formatToolArgs(call.args)).toContain('/workspace')
    expect(formatToolArgs(call.args)).toContain('https://<site-name>.<site-domain-suffix>/')
  })

  it('formats provider function argument strings as readable JSON', () => {
    const call = normalizeToolCall({
      id: 'call-2',
      function: {
        name: 'list_studio_routes',
        arguments: '{"sites":["welcome"],"site_public_urls":["https://welcome.localhost"],"runtime_api_routes":["/runtime-api/health"]}',
      },
    })

    expect(call.name).toBe('list_studio_routes')
    expect(getToolArgsCount(call.args)).toBe(3)
    expect(formatToolArgs(call.args)).toContain('"site_public_urls"')
    expect(formatToolArgs(call.args)).toContain('"runtime_api_routes"')
  })
})
