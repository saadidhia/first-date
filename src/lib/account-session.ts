import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'

const COOKIE = 'matchy_session'
const SESSION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32)
    throw new Error('SESSION_SECRET must be set (32+ characters)')
  return s
}

const sign = (payload: string) =>
  createHmac('sha256', secret()).update(payload).digest('base64url')

const digest = (v: string) => createHash('sha256').update(v).digest()

function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b))
}

/** Hashes a password with a per-account random salt (scrypt). */
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

/** Checks a password against a stored hash + salt, in constant time. */
export function verifyPassword(password: string, hash: string, salt: string) {
  const got = scryptSync(password, salt, 64)
  const want = Buffer.from(hash, 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}

/** Starts a signed session cookie for an account. */
export function startSession(accountId: number) {
  const payload = Buffer.from(
    JSON.stringify({ a: accountId, x: Date.now() + SESSION_MS }),
  ).toString('base64url')
  setCookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MS / 1000,
  })
}

export function clearSession() {
  deleteCookie(COOKIE, { path: '/' })
}

/** The signed-in account id, or throws. Use at the top of logged-in server functions. */
export function requireAccountId(): number {
  const id = getAccountId()
  if (!id) throw new Error('لازم تدخل لحسابك الأول')
  return id
}

/** The signed-in account id, or null. Call this in every logged-in server function. */
export function getAccountId(): number | null {
  const raw = getCookie(COOKIE)
  if (!raw) return null
  const [payload, sig] = raw.split('.')
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null
  try {
    const { a, x } = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as { a: number; x: number }
    return x > Date.now() ? a : null
  } catch {
    return null
  }
}
