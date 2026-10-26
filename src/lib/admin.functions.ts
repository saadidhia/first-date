import { createServerFn } from '@tanstack/react-start'
import { desc, eq, gt, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { activityMinutes, players, rooms } from '../../db/schema'
import { adminLogin, adminLogout, getAdminEmail } from './admin-session'

// A player counts as "using the site now" if their room polled within this window
const ACTIVE_MS = 20_000
const HOUR_MS = 60 * 60 * 1000
// Days in the daily table, counted in Tunisia time
const TZ = sql.raw(`'Africa/Tunis'`)
const DAYS = 30

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
  const [{ lastHour }] = await db
    .select({ lastHour: sql<number>`count(*)::int` })
    .from(players)
    .where(gt(players.lastSeenAt, new Date(Date.now() - HOUR_MS)))
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
    lastHour,
    today: await emptyToday(),
    games: await gamesByMode(),
    days: await dailyStats(),
    recent: recent.map((p) => ({
      ...p,
      online: Date.now() - p.lastSeenAt.getTime() < ACTIVE_MS,
      lastSeenAt: p.lastSeenAt.toISOString(),
    })),
    at: new Date().toISOString(),
  }
})

/**
 * Whether the site had nobody on it at some minute today (Tunisia time). Only minutes since
 * activity tracking started count; `since` is null when there is no data for today yet.
 */
async function emptyToday() {
  const rows = await db.execute<{ since: Date | null; empty: number; last_empty: Date | null }>(sql`
    with bounds as (
      select greatest(
        date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ},
        (select min(${activityMinutes.minute}) from ${activityMinutes})
      ) as since
    )
    select
      bounds.since,
      count(g) filter (where a.minute is null)::int as empty,
      max(g) filter (where g is not null and a.minute is null) as last_empty
    from bounds
    left join generate_series(bounds.since, date_trunc('minute', now()) - interval '1 minute', interval '1 minute') g on true
    left join ${activityMinutes} a on a.minute = g
    where exists (select 1 from ${activityMinutes})
    group by bounds.since
  `)
  const row = rows.rows[0]
  if (!row?.since) return { since: null, emptyMinutes: 0, lastEmptyAt: null }
  return {
    since: new Date(row.since).toISOString(),
    emptyMinutes: row.empty,
    lastEmptyAt: row.last_empty ? new Date(row.last_empty).toISOString() : null,
  }
}

/** Games per mode (First Date vs صحاب): all time, finished, and started today (Tunisia time). */
async function gamesByMode() {
  const rows = await db
    .select({
      mode: rooms.mode,
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${rooms.phase} = 'done')::int`,
      today: sql<number>`count(*) filter (where ${rooms.createdAt} >= date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ})::int`,
    })
    .from(rooms)
    .groupBy(rooms.mode)
  const empty = { total: 0, done: 0, today: 0 }
  const of = (mode: string) => rows.find((r) => r.mode === mode) ?? empty
  return { date: of('date'), friends: of('friends') }
}

/** Players and games started each day, plus how many minutes had someone on the site. */
async function dailyStats() {
  const from = new Date(Date.now() - DAYS * 24 * HOUR_MS)
  const byDay = (column: unknown) => sql<string>`to_char(${column} at time zone ${TZ}, 'YYYY-MM-DD')`
  const count = sql<number>`count(*)::int`

  const [playerRows, roomRows, minuteRows] = await Promise.all([
    db.select({ day: byDay(players.createdAt), n: count }).from(players).where(gt(players.createdAt, from)).groupBy(sql`1`),
    db
      .select({
        day: byDay(rooms.createdAt),
        n: count,
        friends: sql<number>`count(*) filter (where ${rooms.mode} = 'friends')::int`,
      })
      .from(rooms)
      .where(gt(rooms.createdAt, from))
      .groupBy(sql`1`),
    db
      .select({ day: byDay(activityMinutes.minute), n: count })
      .from(activityMinutes)
      .where(gt(activityMinutes.minute, from))
      .groupBy(sql`1`),
  ])
  const toMap = (rows: { day: string; n: number }[]) => new Map(rows.map((r) => [r.day, r.n]))
  const p = toMap(playerRows)
  const r = toMap(roomRows)
  const f = new Map(roomRows.map((row) => [row.day, row.friends]))
  const m = toMap(minuteRows)

  const days = [...new Set([...p.keys(), ...r.keys(), ...m.keys()])].sort().reverse()
  return days.map((day) => ({
    day,
    players: p.get(day) ?? 0,
    rooms: r.get(day) ?? 0,
    dateRooms: (r.get(day) ?? 0) - (f.get(day) ?? 0),
    friendsRooms: f.get(day) ?? 0,
    activeMinutes: m.get(day) ?? null,
  }))
}
