import type { H3Event } from 'h3'
import { createError, deleteCookie, getCookie, getRequestHeader, setCookie } from 'h3'
import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'agent_studio_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

function configuredPassword() {
  const config = useRuntimeConfig()
  return config.STUDIO_PASSWORD || process.env.STUDIO_PASSWORD || 'agent-studio'
}

function sessionSecret() {
  const config = useRuntimeConfig()
  return config.AUTH_SECRET || process.env.AUTH_SECRET || configuredPassword()
}

function sign(value: string) {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url')
}

function createSessionValue() {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'operator',
      iat: Math.floor(Date.now() / 1000),
    })
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function verifySessionValue(value: string | undefined) {
  if (!value) return false
  const [payload, signature] = value.split('.')
  if (!payload || !signature) return false

  const expected = sign(payload)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return false
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { iat?: unknown }
    const issuedAt = typeof parsed.iat === 'number' ? parsed.iat : 0
    return issuedAt > 0 && Math.floor(Date.now() / 1000) - issuedAt <= SESSION_MAX_AGE_SECONDS
  } catch {
    return false
  }
}

export function isAuthenticated(event: H3Event) {
  return verifySessionValue(getCookie(event, COOKIE_NAME))
}

export function isCookieHeaderAuthenticated(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return false
  const value = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)
  return verifySessionValue(value)
}

export function requireAuthenticated(event: H3Event) {
  if (!isAuthenticated(event)) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
}

export function setAuthenticated(event: H3Event) {
  const forwardedProto = getRequestHeader(event, 'x-forwarded-proto')
  setCookie(event, COOKIE_NAME, createSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: forwardedProto === 'https',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export function clearAuthenticated(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}
