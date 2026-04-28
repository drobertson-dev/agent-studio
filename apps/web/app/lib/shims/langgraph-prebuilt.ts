// Browser stub for @langchain/langgraph/prebuilt
// Export minimal no-op placeholders so client bundles don't pull Node-only code.

export const agent_executor = {}
export const chat_agent_executor = {}
export const react_agent_executor = {}
export const tool_executor = {}
export const tool_node = {}
export const interrupt = () => {
  return { when: 'breakpoint' as const }
}

export default {}
