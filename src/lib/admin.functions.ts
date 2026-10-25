import { createServerFn } from '@tanstack/react-start'
import { getUser } from '@netlify/identity'
import { desc, eq, gt, sql } from 'drizzle-orm'

import { db } from '../../db'
import { players, rooms } from '../../db/schema'
import { isAdminEmail } from './admin-emails'

// A player counts as "using the site now" if their room polled within this window
const ACTIVE_MS = 20_000
const HOUR_MS = 60 * 60 * 1000

type IdentityUser = NonNullable<Awaited<ReturnType<typeof getUser>>>

// getUser() verifies the session cookie, so the email and roles here come from the signed token
const isAdmin = (user: IdentityUser) =>
  (user.roles ?? []).includes('admin') || isAdminEmail(user.email)

/** Who the signed-in Identity user is, and whether they are an admin. */
export const getAdminUser = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getUser()
  if (!user) return null
  return { email: user.email ?? '', isAdmin: isAdmin(user) }
})

export const getAdminStats = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getUser()
  if (!user || !isAdmin(user)) throw new Error('ما عندكش الحق تشوف الصفحة هذي')

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
