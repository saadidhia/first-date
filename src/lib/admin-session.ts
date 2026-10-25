import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, getRequestHeader, setCookie } from '@tanstack/react-start/server'

const COOKIE = 'admin_session'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_FAILS = 8
const LOCK_MS = 15 * 60 * 1000

// Failed login attempts per client IP (in memory, resets on restart)
const fails = new Map<string, { count: number; resetAt: number }>()

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters)')
  return s
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')

const digest = (v: string) => createHash('sha256').update(v).digest()

function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b))
}

// Caddy appends the real client IP last in X-Forwarded-For
function clientIp() {
  const xff = getRequestHeader('x-forwarded-for')
  return xff?.split(',').pop()?.trim() || 'unknown'
}

/** Checks the admin credentials from env and starts a signed session cookie. */
export function adminLogin(email: string, password: string) {
  const ip = clientIp()
  const now = Date.now()
  const entry = fails.get(ip)
  if (entry && entry.resetAt > now && entry.count >= MAX_FAILS) return false

  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const expectedPassword = process.env.ADMIN_PASSWORD
  const ok =
    !!expectedEmail &&
    !!expectedPassword &&
    // Evaluate both so the timing doesn't reveal which one was wrong
    [safeEqual(email.trim().toLowerCase(), expectedEmail), safeEqual(password, expectedPassword)].every(Boolean)

  if (!ok) {
    const fresh = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + LOCK_MS }
    fresh.count++
    fails.set(ip, fresh)
    return false
  }

  fails.delete(ip)
  const payload = Buffer.from(JSON.stringify({ e: expectedEmail, x: now + SESSION_MS })).toString('base64url')
  setCookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MS / 1000,
  })
  return true
}

export function adminLogout() {
  deleteCookie(COOKIE, { path: '/' })
}

/** The signed-in admin's email, or null. Call this in every admin-only server function. */
export function getAdminEmail(): string | null {
  const raw = getCookie(COOKIE)
  if (!raw) return null
  const [payload, sig] = raw.split('.')
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { e: string; x: number }
    return x > Date.now() ? e : null
  } catch {
    return null
  }
}
