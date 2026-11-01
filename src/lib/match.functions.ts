import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, gt, isNotNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import {
  accounts,
  answers,
  friendships,
  matchInvites,
  matches,
  players,
  rooms,
  walletTx,
} from '../../db/schema'
import { authorize } from './room-auth'
import { computeCompat } from './compat'
import { INTRO_SECONDS, pickQuestionIds } from './questions'
import { requireAccountId } from './account-session'

// A player counts as "free now" if their account was seen within this window.
const ONLINE_MS = 40_000
// The starter must be able to cover the biggest possible charge before starting.
const MAX_CHARGE = 3000

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function makeCode() {
  let c = ''
  for (let i = 0; i < 6; i++)
    c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return c
}

const later = (s: number) => new Date(Date.now() + s * 1000)

/** Coins charged to the starter, and whether it counts as a match, by score. */
export function priceFor(score: number): { matched: boolean; charge: number } {
  if (score < 50) return { matched: false, charge: 100 }
  if (score === 50) return { matched: true, charge: 3000 }
  if (score <= 75) return { matched: true, charge: 2500 }
  return { matched: true, charge: 2000 }
}

function ageOf(birthday: string): number | null {
  const d = new Date(birthday)
  if (Number.isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)))
}

/** The accounts currently in an unfinished match game: they can't be invited. */
async function busyAccountIds(): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ accountId: players.accountId })
    .from(players)
    .innerJoin(rooms, eq(players.roomId, rooms.id))
    .where(
      and(
        eq(rooms.mode, 'match'),
        ne(rooms.phase, 'done'),
        isNotNull(players.accountId),
      ),
    )
  return new Set(rows.map((r) => r.accountId as number))
}

/** The hub: my coins, who is free now, and my pending invites (in and out). */
export const getLobby = createServerFn({ method: 'POST' }).handler(async () => {
  const me = await requireAccountId()
  await db
    .update(accounts)
    .set({ lastSeenAt: new Date() })
    .where(eq(accounts.id, me))

  const [mine] = await db
    .select({ coins: accounts.coins })
    .from(accounts)
    .where(eq(accounts.id, me))
    .limit(1)

  const busy = await busyAccountIds()
  const cutoff = new Date(Date.now() - ONLINE_MS)
  const online = await db
    .select({
      id: accounts.id,
      username: accounts.username,
      name: accounts.name,
      gender: accounts.gender,
      birthday: accounts.birthday,
    })
    .from(accounts)
    .where(and(ne(accounts.id, me), gt(accounts.lastSeenAt, cutoff)))
    .orderBy(asc(accounts.name))

  const free = online
    .filter((a) => !busy.has(a.id))
    .map((a) => ({
      username: a.username,
      name: a.name,
      gender: a.gender as 'male' | 'female' | null,
      age: ageOf(a.birthday),
    }))

  const incoming = await db
    .select({
      id: matchInvites.id,
      code: rooms.code,
      name: accounts.name,
      username: accounts.username,
      gender: accounts.gender,
      birthday: accounts.birthday,
    })
    .from(matchInvites)
    .innerJoin(rooms, eq(matchInvites.roomId, rooms.id))
    .innerJoin(accounts, eq(matchInvites.fromId, accounts.id))
    .where(and(eq(matchInvites.toId, me), eq(matchInvites.status, 'pending')))

  const [outgoing] = await db
    .select({
      id: matchInvites.id,
      code: rooms.code,
      name: accounts.name,
      username: accounts.username,
    })
    .from(matchInvites)
    .innerJoin(rooms, eq(matchInvites.roomId, rooms.id))
    .innerJoin(accounts, eq(matchInvites.toId, accounts.id))
    .where(and(eq(matchInvites.fromId, me), eq(matchInvites.status, 'pending')))
    .limit(1)

  return {
    coins: mine?.coins ?? 0,
    maxCharge: MAX_CHARGE,
    free,
    incoming: incoming.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      username: i.username,
      gender: i.gender as 'male' | 'female' | null,
      age: ageOf(i.birthday),
    })),
    outgoing: outgoing
      ? { id: outgoing.id, code: outgoing.code, name: outgoing.name }
      : null,
  }
})

/** Start a match with a free player. Creates the room, joins as host, invites them. */
export const startMatch = createServerFn({ method: 'POST' })
  .validator(z.object({ username: z.string().trim().toLowerCase() }))
  .handler(async ({ data }) => {
    const me = await requireAccountId()

    const [starter] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, me))
      .limit(1)
    if (!starter) throw new Error('لازم تدخل لحسابك الأول')
    if (starter.coins < MAX_CHARGE)
      throw new Error(`لازمك ${MAX_CHARGE} كوان باش تبدا لعبة`)

    const [target] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.username, data.username))
      .limit(1)
    if (!target) throw new Error('اللاعب هذا موش موجود')
    if (target.id === me) throw new Error('ما تنجّمش تلعب مع روحك')

    const busy = await busyAccountIds()
    if (busy.has(me)) throw new Error('إنت ديجا في لعبة، كمّلها الأول')
    if (busy.has(target.id)) throw new Error('اللاعب هذا مشغول في لعبة توّا')
    const seen = new Date(Date.now() - ONLINE_MS)
    if (target.lastSeenAt < seen)
      throw new Error('اللاعب هذا موش متّصل توّا')

    const questionIds = pickQuestionIds('date', [])
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode()
      const [room] = await db
        .insert(rooms)
        .values({ code, mode: 'match', phase: 'waiting', questionIds })
        .onConflictDoNothing()
        .returning()
      if (!room) continue
      const token = crypto.randomUUID()
      await db.insert(players).values({
        roomId: room.id,
        name: starter.name,
        gender: starter.gender,
        role: 'host',
        accountId: starter.id,
        token,
      })
      await db.insert(matchInvites).values({
        roomId: room.id,
        fromId: starter.id,
        toId: target.id,
        status: 'pending',
      })
      return { code, token, targetName: target.name }
    }
    throw new Error('صار مشكل، عاود جرّب')
  })

/** Accept or decline an incoming match invite. */
export const respondInvite = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int(), accept: z.boolean() }))
  .handler(async ({ data }) => {
    const me = await requireAccountId()
    return db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(matchInvites)
        .where(eq(matchInvites.id, data.id))
        .for('update')
        .limit(1)
      if (!invite || invite.toId !== me || invite.status !== 'pending')
        throw new Error('الدعوة هذي ما عادش موجودة')

      if (!data.accept) {
        await tx
          .update(matchInvites)
          .set({ status: 'declined' })
          .where(eq(matchInvites.id, invite.id))
        // Drop the room the starter was waiting in (cascades to their player row)
        await tx.delete(rooms).where(eq(rooms.id, invite.roomId))
        return { accepted: false as const }
      }

      const [room] = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.id, invite.roomId))
        .for('update')
        .limit(1)
      if (!room || room.phase !== 'waiting')
        throw new Error('اللعبة ما عادش موجودة')

      const [acc] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, me))
        .limit(1)
      const token = crypto.randomUUID()
      await tx.insert(players).values({
        roomId: room.id,
        name: acc.name,
        gender: acc.gender,
        role: 'guest',
        accountId: me,
        token,
      })
      await tx
        .update(matchInvites)
        .set({ status: 'accepted' })
        .where(eq(matchInvites.id, invite.id))
      // The game begins, like a date when the guest joins
      await tx
        .update(rooms)
        .set({ phase: 'intro', phaseEndsAt: later(INTRO_SECONDS) })
        .where(and(eq(rooms.id, room.id), eq(rooms.phase, 'waiting')))
      return { accepted: true as const, code: room.code, token }
    })
  })

/** The starter cancels their pending invite and closes the waiting room. */
export const cancelInvite = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const me = await requireAccountId()
    const [invite] = await db
      .select()
      .from(matchInvites)
      .where(eq(matchInvites.id, data.id))
      .limit(1)
    if (!invite || invite.fromId !== me) return { ok: true }
    await db
      .update(matchInvites)
      .set({ status: 'cancelled' })
      .where(eq(matchInvites.id, invite.id))
    if (invite.status === 'pending')
      await db.delete(rooms).where(eq(rooms.id, invite.roomId))
    return { ok: true }
  })

/**
 * The match result: the compatibility score, whether they matched, and the coins
 * charged to the starter. Finalises exactly once (unique row per room), so calling
 * it from either player is safe.
 */
export const getMatchResult = createServerFn({ method: 'POST' })
  .validator(z.object({ code: z.string(), token: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { room, player: me } = await authorize(data.code, data.token)
    if (room.mode !== 'match') throw new Error('اللعبة هذي موش لعبة ماتشي')
    if (room.phase !== 'done') throw new Error('مازال ما كمّلتوش الأسئلة')

    const roster = await db
      .select()
      .from(players)
      .where(eq(players.roomId, room.id))
      .orderBy(asc(players.id))
    const partner = roster.find((p) => p.id !== me.id)
    if (!partner || !me.accountId || !partner.accountId)
      throw new Error('ما فمّاش لاعب ثاني')

    const starterPlayer = roster.find((p) => p.role === 'host') ?? roster[0]
    const starterId = starterPlayer.accountId as number
    const otherId =
      starterId === roster[0].accountId
        ? (roster[1].accountId as number)
        : (roster[0].accountId as number)

    const all = await db
      .select()
      .from(answers)
      .where(eq(answers.roomId, room.id))
    const lite = (pid: number) =>
      all
        .filter((a) => a.playerId === pid)
        .map((a) => ({
          questionIndex: a.questionIndex,
          optionIndex: a.optionIndex,
          text: a.text,
        }))
    const compat = computeCompat(
      room.questionIds,
      lite(me.id),
      lite(partner.id),
      { mode: 'date', myGender: me.gender, partnerGender: partner.gender },
    )
    const score = compat.score
    const { matched, charge } = priceFor(score)

    // Finalise once: whoever calls first inserts the match row and charges the starter.
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(matches)
        .values({
          roomId: room.id,
          starterId,
          otherId,
          scorePct: score,
          matched,
          coinsCharged: charge,
        })
        .onConflictDoNothing()
        .returning()
      if (!created) return // already finalised

      await tx
        .update(accounts)
        .set({ coins: sql`GREATEST(0, ${accounts.coins} - ${charge})` })
        .where(eq(accounts.id, starterId))
      await tx.insert(walletTx).values({
        accountId: starterId,
        amount: -charge,
        reason: 'match',
        roomId: room.id,
      })
      if (matched) {
        await tx
          .insert(friendships)
          .values([
            { accountId: starterId, friendId: otherId },
            { accountId: otherId, friendId: starterId },
          ])
          .onConflictDoNothing()
      }
    })

    const [partnerAcc] = await db
      .select({
        username: accounts.username,
        name: accounts.name,
        gender: accounts.gender,
        birthday: accounts.birthday,
      })
      .from(accounts)
      .where(eq(accounts.id, partner.accountId))
      .limit(1)
    const [myAcc] = await db
      .select({ coins: accounts.coins })
      .from(accounts)
      .where(eq(accounts.id, me.accountId))
      .limit(1)

    return {
      score,
      matched,
      coinsCharged: charge,
      iAmStarter: me.accountId === starterId,
      myCoins: myAcc?.coins ?? 0,
      partner: {
        username: partnerAcc?.username ?? '',
        name: partnerAcc?.name ?? partner.name,
        gender: (partnerAcc?.gender ?? partner.gender) as
          | 'male'
          | 'female'
          | null,
        age: partnerAcc ? ageOf(partnerAcc.birthday) : null,
      },
    }
  })
