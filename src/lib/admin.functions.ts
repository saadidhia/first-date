import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, gt, inArray, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { activityMinutes, answers, players, rooms } from '../../db/schema'
import { adminLogin, adminLogout, getAdminEmail } from './admin-session'
import { type AnswerLite, computeCompat } from './compat'

// A player counts as "using the site now" if their room polled within this window
const ACTIVE_MS = 20_000
const HOUR_MS = 60 * 60 * 1000
// Days in the daily table and chart, counted in Tunisia time
const TZ = sql.raw(`'Africa/Tunis'`)
const DAYS = 90
// A pair needs this many questions answered by both before their match % means anything
const MIN_TOGETHER = 3

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
  // Every game where someone polled in the last hour, newest game first (a stable order, so
  // rows don't jump around on each refresh)
  const hourAgo = new Date(Date.now() - HOUR_MS)
  const recent = await listGames(
    sql`exists (select 1 from ${players} where ${players.roomId} = ${rooms.id} and ${players.lastSeenAt} > ${hourAgo})`,
    100,
  )
  return {
    total,
    active,
    lastHour,
    today: await emptyToday(),
    games: await gamesByMode(),
    match: await matchStats(),
    days: await dailyStats(),
    recent,
    at: new Date().toISOString(),
  }
})

type Mode = 'date' | 'friends'
const asMode = (m: string): Mode => (m === 'friends' ? 'friends' : 'date')

/**
 * How well the players of a game match, the same score they see in their report: for a couple
 * their compatibility, for friends every pair's score and the group average. computeCompat is
 * nearly symmetric, so both directions are averaged. Null until they answered enough together.
 */
function matchOf(mode: Mode, qids: string[], members: { id: number; name: string; answers: AnswerLite[] }[]) {
  const pairs: { a: string; b: string; score: number }[] = []
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const [a, b] = [members[i], members[j]]
      const ab = computeCompat(qids, a.answers, b.answers, { mode })
      if (ab.answeredTogether < MIN_TOGETHER) continue
      const ba = computeCompat(qids, b.answers, a.answers, { mode })
      pairs.push({ a: a.name, b: b.name, score: Math.round((ab.score + ba.score) / 2) })
    }
  }
  if (!pairs.length) return null
  pairs.sort((x, y) => y.score - x.score)
  return { score: Math.round(pairs.reduce((n, p) => n + p.score, 0) / pairs.length), pairs }
}

/** Every answer of these rooms, by room and player. */
async function answersOf(roomIds: number[]) {
  const rows = roomIds.length
    ? await db
        .select({
          roomId: answers.roomId,
          playerId: answers.playerId,
          questionIndex: answers.questionIndex,
          optionIndex: answers.optionIndex,
          text: answers.text,
        })
        .from(answers)
        .where(inArray(answers.roomId, roomIds))
    : []
  const byPlayer = new Map<number, AnswerLite[]>()
  for (const a of rows) byPlayer.set(a.playerId, [...(byPlayer.get(a.playerId) ?? []), a])
  return (playerId: number) => byPlayer.get(playerId) ?? []
}

/** Games with all their players (host first), newest first. */
async function listGames(where: SQL | undefined, limit: number) {
  const rows = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      mode: rooms.mode,
      phase: rooms.phase,
      currentIndex: rooms.currentIndex,
      questions: sql<number>`jsonb_array_length(${rooms.questionIds})::int`,
      questionIds: rooms.questionIds,
      createdAt: rooms.createdAt,
    })
    .from(rooms)
    .where(where)
    .orderBy(desc(rooms.createdAt), desc(rooms.id))
    .limit(limit)
  const people = rows.length
    ? await db
        .select({
          id: players.id,
          roomId: players.roomId,
          name: players.name,
          gender: players.gender,
          lastSeenAt: players.lastSeenAt,
        })
        .from(players)
        .where(inArray(players.roomId, rows.map((r) => r.id)))
        .orderBy(asc(players.id))
    : []
  const answersFor = await answersOf(rows.map((r) => r.id))
  return rows.map(({ questionIds, ...r }) => {
    const roster = people.filter((p) => p.roomId === r.id)
    const mode = asMode(r.mode)
    return {
    ...r,
    mode,
    createdAt: r.createdAt.toISOString(),
    match: matchOf(mode, questionIds, roster.map((p) => ({ id: p.id, name: p.name, answers: answersFor(p.id) }))),
    players: roster
      .map((p) => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        online: Date.now() - p.lastSeenAt.getTime() < ACTIVE_MS,
        lastSeenAt: p.lastSeenAt.toISOString(),
      })),
    }
  })
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
      conditions.push(
        sql`exists (select 1 from ${players} where ${players.roomId} = ${rooms.id} and ${players.name} ilike ${like})`,
      )
    }
    // One extra row tells the page whether there are more to load
    const games = await listGames(and(...conditions), data.limit + 1)
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

// Match % buckets, the same cut-offs as the verdict in the players' report
const BUCKETS = [80, 65, 50, 0] as const
let matchCache: { at: number; value: Awaited<ReturnType<typeof computeMatchStats>> } | null = null

/** Average match % of finished games, couples and friends apart. Cached for a minute. */
async function matchStats() {
  if (!matchCache || Date.now() - matchCache.at > 60_000)
    matchCache = { at: Date.now(), value: await computeMatchStats() }
  return matchCache.value
}

async function computeMatchStats() {
  const done = await db
    .select({ id: rooms.id, mode: rooms.mode, questionIds: rooms.questionIds })
    .from(rooms)
    .where(eq(rooms.phase, 'done'))
  const roster = done.length
    ? await db
        .select({ id: players.id, roomId: players.roomId, name: players.name })
        .from(players)
        .where(inArray(players.roomId, done.map((r) => r.id)))
    : []
  const answersFor = await answersOf(done.map((r) => r.id))
  const scores = { date: [] as number[], friends: [] as number[] }
  for (const r of done) {
    const mode = asMode(r.mode)
    const members = roster.filter((p) => p.roomId === r.id).map((p) => ({ ...p, answers: answersFor(p.id) }))
    const m = matchOf(mode, r.questionIds, members)
    if (!m) continue
    // A couple counts once; a group counts each of its pairs
    if (mode === 'date') scores.date.push(m.score)
    else scores.friends.push(...m.pairs.map((p) => p.score))
  }
  const summary = (list: number[]) => ({
    count: list.length,
    average: list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null,
    best: list.length ? Math.max(...list) : null,
    buckets: BUCKETS.map((from, i) => ({
      from,
      to: i === 0 ? 100 : BUCKETS[i - 1] - 1,
      count: list.filter((s) => s >= from && (i === 0 || s < BUCKETS[i - 1])).length,
    })),
  })
  return { date: summary(scores.date), friends: summary(scores.friends) }
}
