export default defineEventHandler((event) => {
  const path = event.path || '/'
  if (path.startsWith('/api/auth')) return
  if (path.startsWith('/api/langgraph') || path.startsWith('/_ws/langgraph')) {
    requireAuthenticated(event)
  }
})
