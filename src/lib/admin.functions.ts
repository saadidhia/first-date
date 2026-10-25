import { createServerFn } from '@tanstack/react-start'
import { desc, eq, gt, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { players, rooms } from '../../db/schema'
import { adminLogin, adminLogout, getAdminEmail } from './admin-session'

// A player counts as "using the site now" if their room polled within this window
const ACTIVE_MS = 20_000
const HOUR_MS = 60 * 60 * 1000

/** The signed-in admin, or null. */
export const getAdminUser = createServerFn({ method: 'GET' }).handler(async () => {
  const email = getAdminEmail()
  return email ? { email, isAdmin: true } : null
})

export const loginAdmin = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().max(200), password: z.string().max(200) }))
  .handler(async ({ data }) => {
    if (!adminLogin(data.email, data.password)) throw new Error('invalid credentials')
  })

export const logoutAdmin = createServerFn({ method: 'POST' }).handler(async () => {
  adminLogout()
})

export const getAdminStats = createServerFn({ method: 'GET' }).handler(async () => {
  if (!getAdminEmail()) throw new Error('ما عندكش الحق تشوف الصفحة هذي')

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(players)
  const [{ active }] = await db
    .select({ active: sql<number>`count(*)::int` })
    .from(players)
    .where(gt(players.lastSeenAt, new Date(Date.now() - ACTIVE_MS)))
  // Everyone whose room polled in the last hour, most recent first
  const recent = await db
    .select({
      id: players.id,
      name: players.name,
      gender: players.gender,
      code: rooms.code,
      phase: rooms.phase,
      lastSeenAt: players.lastSeenAt,
    })
    .from(players)
    .innerJoin(rooms, eq(players.roomId, rooms.id))
    .where(gt(players.lastSeenAt, new Date(Date.now() - HOUR_MS)))
    .orderBy(desc(players.lastSeenAt))
    .limit(200)
  return {
    total,
    active,
    lastHour: recent.length,
    recent: recent.map((p) => ({
      ...p,
      online: Date.now() - p.lastSeenAt.getTime() < ACTIVE_MS,
      lastSeenAt: p.lastSeenAt.toISOString(),
    })),
    at: new Date().toISOString(),
  }
})
