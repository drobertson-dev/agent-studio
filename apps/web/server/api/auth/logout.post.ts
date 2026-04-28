import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  clearAuthenticated(event)
  return { authenticated: false }
})
