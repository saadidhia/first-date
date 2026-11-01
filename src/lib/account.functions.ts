import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { accounts, walletTx } from '../../db/schema'
import {
  clearSession,
  getAccountId,
  hashPassword,
  startSession,
  verifyPassword,
} from './account-session'

const SIGNUP_BONUS = 3000

// Latin-friendly, love/Tunisia-themed stems for the generated username.
const STEMS = [
  'habib',
  'yasmin',
  'najm',
  'amir',
  'warda',
  'kamar',
  'nour',
  'sahar',
  'malek',
  'rimel',
  'jasmin',
  'firas',
  'lilia',
  'anis',
  'mariem',
  'skander',
  'ryma',
  'zina',
  'bahri',
  'chams',
]

const nameSchema = z.string().trim().min(1, 'اكتب اسمك').max(24)
const passwordSchema = z
  .string()
  .min(6, 'الباسوورد لازم 6 حروف على الأقل')
  .max(100)
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, 'اسم المستخدم غالط')

// A valid date, not in the future. No minimum age is enforced.
const birthdaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ غالط')
  .refine((s) => {
    const d = new Date(s)
    return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now()
  }, 'التاريخ غالط')

function clientIp() {
  const xff = getRequestHeader('x-forwarded-for')
  return xff?.split(',').pop()?.trim() || 'unknown'
}

// Simple in-memory login throttle per IP (resets on restart)
const fails = new Map<string, { count: number; resetAt: number }>()
const MAX_FAILS = 10
const LOCK_MS = 15 * 60 * 1000

async function makeUsername(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const stem = STEMS[Math.floor(Math.random() * STEMS.length)]
    const num = 100 + Math.floor(Math.random() * 9900)
    const username = `${stem}_${num}`
    const [exists] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.username, username))
      .limit(1)
    if (!exists) return username
  }
  // Fallback: timestamp-based, practically unique
  return `user_${Date.now().toString(36)}`
}

export const signup = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: nameSchema,
      birthday: birthdaySchema,
      password: passwordSchema,
      gender: z.enum(['male', 'female']).nullable().default(null),
    }),
  )
  .handler(async ({ data }) => {
    const { hash, salt } = hashPassword(data.password)
    const username = await makeUsername()
    const account = await db.transaction(async (tx) => {
      const [acc] = await tx
        .insert(accounts)
        .values({
          username,
          name: data.name,
          birthday: data.birthday,
          gender: data.gender,
          passwordHash: hash,
          passwordSalt: salt,
          coins: SIGNUP_BONUS,
        })
        .returning()
      if (SIGNUP_BONUS > 0)
        await tx.insert(walletTx).values({
          accountId: acc.id,
          amount: SIGNUP_BONUS,
          reason: 'signup_bonus',
        })
      return acc
    })
    startSession(account.id)
    return {
      id: account.id,
      username: account.username,
      name: account.name,
      coins: account.coins,
      gender: account.gender as 'male' | 'female' | null,
    }
  })

export const login = createServerFn({ method: 'POST' })
  .validator(
    z.object({ username: usernameSchema, password: z.string().min(1).max(100) }),
  )
  .handler(async ({ data }) => {
    const ip = clientIp()
    const now = Date.now()
    const entry = fails.get(ip)
    if (entry && entry.resetAt > now && entry.count >= MAX_FAILS)
      throw new Error('برشة محاولات، استنّى شويّة وعاود')

    const [acc] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.username, data.username))
      .limit(1)
    const ok =
      !!acc &&
      verifyPassword(data.password, acc.passwordHash, acc.passwordSalt)
    if (!ok || !acc) {
      const fresh =
        entry && entry.resetAt > now
          ? entry
          : { count: 0, resetAt: now + LOCK_MS }
      fresh.count++
      fails.set(ip, fresh)
      throw new Error('اسم المستخدم ولا الباسوورد غالط')
    }
    fails.delete(ip)
    await db
      .update(accounts)
      .set({ lastSeenAt: new Date() })
      .where(eq(accounts.id, acc.id))
    startSession(acc.id)
    return {
      id: acc.id,
      username: acc.username,
      name: acc.name,
      coins: acc.coins,
      gender: acc.gender as 'male' | 'female' | null,
    }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  clearSession()
  return { ok: true }
})

/** The signed-in account, or null. */
export const getMe = createServerFn({ method: 'GET' }).handler(async () => {
  const id = getAccountId()
  if (!id) return null
  const [acc] = await db
    .select({
      id: accounts.id,
      username: accounts.username,
      name: accounts.name,
      coins: accounts.coins,
      gender: accounts.gender,
      birthday: accounts.birthday,
    })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1)
  if (!acc) return null
  // Light heartbeat so "free now" stays fresh when the hub is open
  await db
    .update(accounts)
    .set({ lastSeenAt: new Date() })
    .where(eq(accounts.id, id))
  return { ...acc, gender: acc.gender as 'male' | 'female' | null }
})

