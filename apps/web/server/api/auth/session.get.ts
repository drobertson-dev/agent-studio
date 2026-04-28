import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  return { authenticated: isAuthenticated(event) }
})
