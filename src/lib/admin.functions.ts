import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gt, ilike, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { z } from 'zod'

import { db } from '../../db'
import { activityMinutes, players, rooms } from '../../db/schema'
import { adminLogin, adminLogout, getAdminEmail } from './admin-session'

// A player counts as "using the site now" if their room polled within this window
const ACTIVE_MS = 20_000
const HOUR_MS = 60 * 60 * 1000
// Days in the daily table and chart, counted in Tunisia time
const TZ = sql.raw(`'Africa/Tunis'`)
const DAYS = 90

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
  // Every game where someone polled in the last hour, most recent first
  const hourAgo = new Date(Date.now() - HOUR_MS)
  const recent = await listGames(or(gt(host.lastSeenAt, hourAgo), gt(guest.lastSeenAt, hourAgo)), 'seen', 100)
  return {
    total,
    active,
    lastHour,
    today: await emptyToday(),
    games: await gamesByMode(),
    days: await dailyStats(),
    recent,
    at: new Date().toISOString(),
  }
})

const host = alias(players, 'host')
const guest = alias(players, 'guest')

/** Games with both their players (guest is null until someone joins), newest first. */
async function listGames(where: SQL | undefined, order: 'created' | 'seen', limit: number) {
  const lastSeen = sql`greatest(${host.lastSeenAt}, coalesce(${guest.lastSeenAt}, ${host.lastSeenAt}))`
  const rows = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      mode: rooms.mode,
      phase: rooms.phase,
      currentIndex: rooms.currentIndex,
      questions: sql<number>`jsonb_array_length(${rooms.questionIds})::int`,
      createdAt: rooms.createdAt,
      host: { id: host.id, name: host.name, gender: host.gender, lastSeenAt: host.lastSeenAt },
      guest: { id: guest.id, name: guest.name, gender: guest.gender, lastSeenAt: guest.lastSeenAt },
    })
    .from(rooms)
    .innerJoin(host, and(eq(host.roomId, rooms.id), eq(host.role, 'host')))
    .leftJoin(guest, and(eq(guest.roomId, rooms.id), eq(guest.role, 'guest')))
    .where(where)
    .orderBy(order === 'seen' ? desc(lastSeen) : desc(rooms.createdAt))
    .limit(limit)
  const player = (p: { id: number; name: string; gender: string | null; lastSeenAt: Date } | null) =>
    p && {
      ...p,
      online: Date.now() - p.lastSeenAt.getTime() < ACTIVE_MS,
      lastSeenAt: p.lastSeenAt.toISOString(),
    }
  return rows.map((r) => ({
    ...r,
    mode: r.mode === 'friends' ? ('friends' as const) : ('date' as const),
    createdAt: r.createdAt.toISOString(),
    host: player(r.host)!,
    guest: player(r.guest),
  }))
}

export type AdminGame = Awaited<ReturnType<typeof listGames>>[number]

/** Who played with who: games by type, optionally only those where a player's name matches. */
export const getAdminGames = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      mode: z.enum(['all', 'date', 'friends']),
      q: z.string().trim().max(50),
      limit: z.number().int().min(1).max(500),
    }),
  )
  .handler(async ({ data }) => {
    if (!getAdminEmail()) throw new Error('ما عندكش الحق تشوف الصفحة هذي')
    const conditions: (SQL | undefined)[] = []
    if (data.mode !== 'all') conditions.push(eq(rooms.mode, data.mode))
    if (data.q) {
      const like = `%${data.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      conditions.push(or(ilike(host.name, like), ilike(guest.name, like)))
    }
    // One extra row tells the page whether there are more to load
    const games = await listGames(and(...conditions), 'created', data.limit + 1)
    return { games: games.slice(0, data.limit), more: games.length > data.limit }
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
    db
      .select({
        day: byDay(players.createdAt),
        n: count,
        friends: sql<number>`count(*) filter (where ${rooms.mode} = 'friends')::int`,
      })
      .from(players)
      .innerJoin(rooms, eq(players.roomId, rooms.id))
      .where(gt(players.createdAt, from))
      .groupBy(sql`1`),
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
  const pf = new Map(playerRows.map((row) => [row.day, row.friends]))
  const m = toMap(minuteRows)

  const days = [...new Set([...p.keys(), ...r.keys(), ...m.keys()])].sort().reverse()
  return days.map((day) => ({
    day,
    players: p.get(day) ?? 0,
    datePlayers: (p.get(day) ?? 0) - (pf.get(day) ?? 0),
    friendsPlayers: pf.get(day) ?? 0,
    rooms: r.get(day) ?? 0,
    dateRooms: (r.get(day) ?? 0) - (f.get(day) ?? 0),
    friendsRooms: f.get(day) ?? 0,
    activeMinutes: m.get(day) ?? null,
  }))
}
