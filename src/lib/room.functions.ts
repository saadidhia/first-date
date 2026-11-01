import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { and, asc, eq, gt, isNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { answers, events, players, rooms } from '../../db/schema'
import { trafficSource } from './traffic'
import { recordActivity } from './activity'
import { authorize } from './room-auth'
import { computeCompat } from './compat'
import { computeGroupReport, computeRounds } from './group'
import { computeMarriageReport } from './marriage'
import {
  INTRO_SECONDS,
  PRIVATE_SECONDS,
  QUESTION_SECONDS,
  REVEAL_SECONDS,
  ROUND_LABEL,
  SPINNING_SECONDS,
  SPIN_SECONDS,
  categoryLabel,
  otherSpin,
  othersGender,
  personalize,
  pickQuestionIds,
  questionFor,
  roundFor,
  withoutVotes,
} from './questions'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ONLINE_MS = 9000
// A date is one host and one guest; a friends room takes up to 7 people and starts when the host says so
const MAX_PLAYERS = { date: 2, friends: 7 } as const
const asMode = (m: string) =>
  (m === 'friends' ? 'friends' : 'date') as 'date' | 'friends'

function makeCode() {
  let c = ''
  for (let i = 0; i < 6; i++)
    c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return c
}

const later = (s: number) => new Date(Date.now() + s * 1000)

const nameSchema = z.string().trim().min(1, 'اكتب اسمك').max(24)
const genderSchema = z.enum(['male', 'female'], {
  error: 'اختار إنتي راجل ولا مرا',
})
const codeSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6}$/, 'الكود لازم يكون 6 حروف'))
const modeSchema = z.enum(['date', 'friends'])
const authSchema = z.object({ code: codeSchema, token: z.string().uuid() })

type Room = typeof rooms.$inferSelect

const guardOf = (room: Room) =>
  and(
    eq(rooms.id, room.id),
    eq(rooms.phase, room.phase),
    eq(rooms.currentIndex, room.currentIndex),
  )

/**
 * The update that opens question `index`. The first spin question waits for the wheel; the
 * wheel turns only once, so the next spin questions go straight to the same player.
 */
function open(room: Room, index: number) {
  if (roundFor(room.questionIds[index])?.kind !== 'spin') {
    return {
      phase: 'question',
      currentIndex: index,
      phaseEndsAt: later(QUESTION_SECONDS),
    }
  }
  const chosen = Object.values(room.spins)[0]
  if (chosen == null)
    return {
      phase: 'spin',
      currentIndex: index,
      phaseEndsAt: later(SPIN_SECONDS),
    }
  return {
    phase: 'question',
    currentIndex: index,
    phaseEndsAt: later(PRIVATE_SECONDS),
    spins: { ...room.spins, [index]: chosen },
  }
}

/** Turns the wheel: picks one player at random and starts the spinning animation. */
async function spinWheel(room: Room) {
  const roster = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.roomId, room.id))
  const chosen = roster[Math.floor(Math.random() * roster.length)]
  if (!chosen) return
  await db
    .update(rooms)
    .set({
      spins: { ...room.spins, [room.currentIndex]: chosen.id },
      phase: 'spinning',
      phaseEndsAt: later(SPINNING_SECONDS),
    })
    .where(guardOf(room))
}

/** Moves the room forward when a timer has expired. Conditional updates keep it race-safe. */
async function advance(room: Room) {
  if (!room.phaseEndsAt || room.phaseEndsAt.getTime() > Date.now()) return
  const guard = guardOf(room)
  if (room.phase === 'intro') {
    await db.update(rooms).set(open(room, 0)).where(guard)
  } else if (room.phase === 'spin') {
    // The host didn't turn the wheel in time: it turns by itself
    await spinWheel(room)
  } else if (room.phase === 'spinning') {
    await db
      .update(rooms)
      .set({ phase: 'question', phaseEndsAt: later(PRIVATE_SECONDS) })
      .where(guard)
  } else if (room.phase === 'question') {
    await db
      .update(rooms)
      .set({ phase: 'reveal', phaseEndsAt: later(REVEAL_SECONDS) })
      .where(guard)
  } else if (room.phase === 'reveal') {
    const next = room.currentIndex + 1
    if (next >= room.questionIds.length) {
      await db
        .update(rooms)
        .set({ phase: 'done', phaseEndsAt: null, endedAt: new Date() })
        .where(guard)
    } else {
      await db.update(rooms).set(open(room, next)).where(guard)
    }
  }
}

export const createRoom = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: nameSchema,
      gender: genderSchema,
      mode: modeSchema.default('date'),
      // Question ids from the host's previous rooms, so a new room brings new questions
      seen: z.array(z.string().max(40)).max(800).default([]),
      // The page the host came from, to work out where our players come from
      ref: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const questionIds = pickQuestionIds(data.mode, data.seen)
    const source = trafficSource(data.ref, getRequestHeader('user-agent'))
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode()
      const [room] = await db
        .insert(rooms)
        .values({ code, mode: data.mode, questionIds, source })
        .onConflictDoNothing()
        .returning()
      if (!room) continue
      const token = crypto.randomUUID()
      await db.insert(players).values({
        roomId: room.id,
        name: data.name,
        gender: data.gender,
        role: 'host',
        token,
      })
      return { code, token, questionIds }
    }
    throw new Error('صار مشكل، عاود جرّب')
  })

export const joinRoom = createServerFn({ method: 'POST' })
  .validator(
    z.object({ name: nameSchema, gender: genderSchema, code: codeSchema }),
  )
  .handler(async ({ data }) => {
    // The room row stays locked until the player is in, so two people can't take the last seat
    return db.transaction(async (tx) => {
      const [room] = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.code, data.code))
        .for('update')
        .limit(1)
      if (!room) throw new Error('الكود هذا غالط، ما فمّا حتى لعبة بيه')
      // A Matchy game is joined only by accepting an invite, never by code
      if (room.mode === 'match')
        throw new Error('اللعبة هذي بالدعوة برك')
      const mode = asMode(room.mode)
      if (mode === 'friends' && room.phase !== 'waiting')
        throw new Error('اللعبة بدات، ما عادش تنجم تدخل')
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(players)
        .where(eq(players.roomId, room.id))
      if (count >= MAX_PLAYERS[mode]) {
        throw new Error(
          mode === 'friends'
            ? 'اللعبة هذي كاملة، فيها 7 ديجا'
            : 'اللعبة هذي كاملة، فيها زوز لاعبين ديجا',
        )
      }
      const token = crypto.randomUUID()
      await tx.insert(players).values({
        roomId: room.id,
        name: data.name,
        gender: data.gender,
        role: 'guest',
        token,
      })
      // A date starts as soon as the guest is in; friends wait for the host to press start
      if (mode === 'date') {
        await tx
          .update(rooms)
          .set({ phase: 'intro', phaseEndsAt: later(INTRO_SECONDS) })
          .where(and(eq(rooms.id, room.id), eq(rooms.phase, 'waiting')))
      }
      return { code: room.code, token, questionIds: room.questionIds }
    })
  })

/** The host of a friends room starts the game once at least one friend has joined. */
export const startRoom = createServerFn({ method: 'POST' })
  .validator(
    authSchema.extend({
      seen: z.array(z.string().max(40)).max(800).default([]),
    }),
  )
  .handler(async ({ data }) => {
    const { room, player } = await authorize(data.code, data.token)
    if (player.role !== 'host')
      throw new Error('اللي حلّ اللعبة هو اللي يبداها')
    if (room.phase !== 'waiting') return { ok: true }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(players)
      .where(eq(players.roomId, room.id))
    if (count < 2) throw new Error('استنّى صاحب واحد على الأقل يدخل')
    await db
      .update(rooms)
      .set({
        phase: 'intro',
        phaseEndsAt: later(INTRO_SECONDS),
        // Two friends can't vote for each other: they get regular questions instead
        questionIds:
          count === 2
            ? withoutVotes(room.questionIds, data.seen)
            : room.questionIds,
      })
      .where(and(eq(rooms.id, room.id), eq(rooms.phase, 'waiting')))
    return { ok: true }
  })

/** The host of a friends room removes a player while the room is still waiting. */
export const kickPlayer = createServerFn({ method: 'POST' })
  .validator(authSchema.extend({ playerId: z.number().int() }))
  .handler(async ({ data }) => {
    const { room, player } = await authorize(data.code, data.token)
    if (room.mode !== 'friends')
      throw new Error('ما تنجّمش تنحّي لاعب في اللعبة هذي')
    if (player.role !== 'host')
      throw new Error('اللي حلّ اللعبة برك ينجّم ينحّي لاعب')
    if (room.phase !== 'waiting')
      throw new Error('ما تنجّمش تنحّي لاعب بعد ما بدات اللعبة')
    if (data.playerId === player.id) throw new Error('ما تنجّمش تنحّي روحك')
    // The host can't be removed; deleting the row cascades to the player's voice membership
    await db
      .delete(players)
      .where(
        and(
          eq(players.id, data.playerId),
          eq(players.roomId, room.id),
          ne(players.role, 'host'),
        ),
      )
    return { ok: true }
  })

/** The host turns the wheel on a spin question. */
export const spin = createServerFn({ method: 'POST' })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const { room, player } = await authorize(data.code, data.token)
    if (player.role !== 'host')
      throw new Error('اللي حلّ اللعبة هو اللي يدوّر العجلة')
    if (room.phase === 'spin') await spinWheel(room)
    return { ok: true }
  })

/**
 * The joker: once per game, the player the wheel picked can swap their private question
 * for another one. The timer starts again.
 */
export const playJoker = createServerFn({ method: 'POST' })
  .validator(authSchema.extend({ index: z.number().int().min(0) }))
  .handler(async ({ data }) => {
    const { room, player } = await authorize(data.code, data.token)
    if (room.phase !== 'question' || room.currentIndex !== data.index) {
      throw new Error('الوقت فات على السؤال هذا ⏱')
    }
    const id = room.questionIds[data.index]
    if (roundFor(id)?.kind !== 'spin' || room.spins[data.index] !== player.id) {
      throw new Error('الجوكر للّي وقفت عليه العجلة برك')
    }
    if (room.joker) throw new Error('الجوكر استعملتو ديجا 🃏')
    const [answered] = await db
      .select({ id: answers.id })
      .from(answers)
      .where(
        and(eq(answers.roomId, room.id), eq(answers.questionIndex, data.index)),
      )
      .limit(1)
    if (answered) throw new Error('جاوبت ديجا')
    const next = otherSpin(room.questionIds)
    if (!next) throw new Error('ما فمّاش سؤال آخر')
    await db
      .update(rooms)
      .set({
        questionIds: room.questionIds.map((q, i) =>
          i === data.index ? next : q,
        ),
        joker: { index: data.index, skipped: id },
        phaseEndsAt: later(PRIVATE_SECONDS),
      })
      .where(and(guardOf(room), isNull(rooms.joker)))
    return { ok: true }
  })

export const getRoomState = createServerFn({ method: 'POST' })
  .validator(
    authSchema.extend({ sinceEventId: z.number().int().min(0).default(0) }),
  )
  .handler(async ({ data }) => {
    const { room: initialRoom, player: me } = await authorize(
      data.code,
      data.token,
    )
    await db
      .update(players)
      .set({ lastSeenAt: new Date() })
      .where(eq(players.id, me.id))
    await recordActivity()
    await advance(initialRoom)

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, initialRoom.id))
    const mode = asMode(room.mode)
    const roster = await db
      .select()
      .from(players)
      .where(eq(players.roomId, room.id))
      .orderBy(asc(players.id))
    const others = roster.filter((p) => p.id !== me.id)
    const og = othersGender(others.map((p) => p.gender))
    const allAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.roomId, room.id))
    const answerOf = (playerId: number, i: number) =>
      allAnswers.find((a) => a.playerId === playerId && a.questionIndex === i)
    const otherEvents = await db
      .select({
        id: events.id,
        playerId: events.playerId,
        type: events.type,
        createdAt: events.createdAt,
      })
      .from(events)
      .where(
        and(
          eq(events.roomId, room.id),
          ne(events.playerId, me.id),
          gt(events.id, data.sinceEventId),
        ),
      )

    const playerById = new Map(roster.map((p) => [p.id, p]))
    const pub = (p: (typeof roster)[number]) => ({
      id: p.id,
      name: p.name,
      gender: p.gender,
    })
    // The player the wheel landed on for question i
    const chosenAt = (i: number) => {
      const id = room.spins[i]
      const p = id != null ? playerById.get(id) : undefined
      return p ? pub(p) : null
    }

    // Only questions that are already revealed expose the other answers
    const revealedUpTo =
      room.phase === 'done'
        ? room.questionIds.length - 1
        : room.phase === 'reveal'
          ? room.currentIndex
          : room.currentIndex - 1
    const history: {
      index: number
      kind: 'question' | 'vote' | 'spin'
      text: string
      category: string
      mine: string | null
      // One entry per other player; text is null when they ran out of time (or on marriage questions).
      // option is the option they picked, null for a reply in their own words.
      // Empty on votes and spins, whose answers only show in the report.
      theirs: { id: number; text: string | null; option: number | null }[]
      // The options as worded for me, and the one I picked, so the group sees who chose what
      options: string[]
      myOption: number | null
      // Marriage questions differ per gender; the partner's answer only shows in the final report
      marriage: boolean
      // The last 5 questions of a date, shown in their own colour
      finale: boolean
      // Other players who picked the same option as me
      sameWith: number[]
      same: boolean
      // Votes: how many voted. Spins: who the wheel picked and whether they answered.
      voters: number
      chosen: { id: number; name: string; gender: string | null } | null
      answered: boolean
      // The chosen player swapped this question with the joker
      joker: boolean
    }[] = []
    for (let i = 0; i <= revealedUpTo && room.phase !== 'waiting'; i++) {
      const id = room.questionIds[i]
      const mine = answerOf(me.id, i)
      const round = roundFor(id)
      if (round) {
        const chosen = chosenAt(i)
        history.push({
          index: i,
          kind: round.kind,
          text:
            round.kind === 'spin'
              ? personalize(round.text, chosen?.gender, null)
              : round.text,
          category: ROUND_LABEL[round.kind],
          mine: mine?.text ?? null,
          theirs: [],
          options: [],
          myOption: null,
          marriage: false,
          finale: false,
          sameWith: [],
          same: false,
          voters: allAnswers.filter((a) => a.questionIndex === i).length,
          chosen,
          answered: !!chosen && !!answerOf(chosen.id, i),
          joker: room.joker?.index === i,
        })
        continue
      }
      const q = questionFor(id, me.gender, og)
      if (!q) continue
      const sameWith = q.marriage
        ? []
        : others
            .filter(
              (o) =>
                mine?.optionIndex != null &&
                answerOf(o.id, i)?.optionIndex === mine.optionIndex,
            )
            .map((o) => o.id)
      history.push({
        index: i,
        kind: 'question',
        text: q.text,
        category: categoryLabel(q.cat, og),
        mine: mine?.text ?? null,
        theirs: others.map((o) => {
          const a = q.marriage ? undefined : answerOf(o.id, i)
          return {
            id: o.id,
            text: a?.text ?? null,
            option: a?.optionIndex ?? null,
          }
        }),
        options: q.marriage ? [] : q.options,
        myOption: mine?.optionIndex ?? null,
        marriage: q.marriage,
        finale: q.finale,
        sameWith,
        same: sameWith.length > 0,
        voters: 0,
        chosen: null,
        answered: false,
        joker: false,
      })
    }

    let current = null
    if (room.phase === 'question') {
      const id = room.questionIds[room.currentIndex]
      const round = roundFor(id)
      const q = round ? null : questionFor(id, me.gender, og)
      const chosen = round?.kind === 'spin' ? chosenAt(room.currentIndex) : null
      if (round || q) {
        current = {
          index: room.currentIndex,
          kind: round?.kind ?? ('question' as const),
          text: round
            ? round.kind === 'spin'
              ? personalize(round.text, chosen?.gender, null)
              : round.text
            : q!.text,
          category: round ? ROUND_LABEL[round.kind] : categoryLabel(q!.cat, og),
          options: q?.options ?? [],
          // Votes: the names to choose from (never yourself)
          choices: round?.kind === 'vote' ? others.map(pub) : [],
          chosen,
          // Only the player the wheel picked answers a spin question
          myTurn: round?.kind === 'spin' ? chosen?.id === me.id : true,
          // Spins: whether the joker was used on this question, and whether it's still there to use
          joker: room.joker?.index === room.currentIndex,
          jokerLeft: round?.kind === 'spin' && !room.joker,
          marriage: q?.marriage ?? false,
          finale: q?.finale ?? false,
          myAnswer: answerOf(me.id, room.currentIndex)?.text ?? null,
          // Who already answered (not what)
          answeredIds: others
            .filter((o) => answerOf(o.id, room.currentIndex))
            .map((o) => o.id),
        }
      }
    }

    // The wheel, while it waits for the host and while it spins
    const wheel =
      room.phase === 'spin' || room.phase === 'spinning'
        ? {
            index: room.currentIndex,
            players: roster.map(pub),
            spinning: room.phase === 'spinning',
            chosen:
              room.phase === 'spinning' ? chosenAt(room.currentIndex) : null,
          }
        : null

    const otherPlayers = others.map((p) => ({
      id: p.id,
      name: p.name,
      gender: p.gender,
      host: p.role === 'host',
      online: Date.now() - p.lastSeenAt.getTime() < ONLINE_MS,
    }))
    return {
      code: room.code,
      mode,
      // A Matchy (logged-in, paid) game: the client hides voice/music and shows the coins result
      isMatch: room.mode === 'match',
      phase: room.phase as
        | 'waiting'
        | 'intro'
        | 'spin'
        | 'spinning'
        | 'question'
        | 'reveal'
        | 'done',
      index: room.currentIndex,
      total: room.questionIds.length,
      // What each question is, for the progress bar
      kinds: room.questionIds.map(
        (id) =>
          roundFor(id)?.kind ??
          (questionFor(id, null)?.finale ? 'finale' : 'question'),
      ),
      phaseEndsAt: room.phaseEndsAt?.toISOString() ?? null,
      serverNow: new Date().toISOString(),
      questionSeconds:
        current?.kind === 'spin' ? PRIVATE_SECONDS : QUESTION_SECONDS,
      spinSeconds: SPIN_SECONDS,
      maxPlayers: MAX_PLAYERS[mode],
      me: { id: me.id, name: me.name, role: me.role, gender: me.gender },
      others: otherPlayers,
      // The only other player in a date (or a friends room of two)
      partner: otherPlayers.length === 1 ? otherPlayers[0] : null,
      current,
      wheel,
      history,
      partnerEvents: otherEvents.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    }
  })

export const submitAnswer = createServerFn({ method: 'POST' })
  .validator(
    authSchema.extend({
      index: z.number().int().min(0),
      optionIndex: z.number().int().min(0).max(2).nullable(),
      text: z.string().trim().max(500).default(''),
      // On vote questions: the player voted for
      voteFor: z.number().int().nullable().default(null),
    }),
  )
  .handler(async ({ data }) => {
    const { room, player } = await authorize(data.code, data.token)
    if (room.phase !== 'question' || room.currentIndex !== data.index) {
      throw new Error('الوقت فات على السؤال هذا ⏱')
    }
    const others = await db
      .select({ id: players.id, name: players.name, gender: players.gender })
      .from(players)
      .where(and(eq(players.roomId, room.id), ne(players.id, player.id)))
    const id = room.questionIds[room.currentIndex]
    const round = roundFor(id)

    let value: { optionIndex: number | null; text: string; voteFor?: number }
    if (round?.kind === 'vote') {
      const target = others.find((o) => o.id === data.voteFor)
      if (!target) throw new Error('اختار واحد من صحابك')
      value = { optionIndex: null, text: target.name, voteFor: target.id }
    } else if (round?.kind === 'spin') {
      if (room.spins[data.index] !== player.id)
        throw new Error('موش دورك، العجلة ما وقفتش عليك')
      if (!data.text) throw new Error('اكتب جوابك')
      value = { optionIndex: null, text: data.text }
    } else {
      // The saved text is shown to the others as is, so it's worded for their gender
      const q = questionFor(
        id,
        player.gender,
        othersGender(others.map((o) => o.gender)),
      )
      const picked =
        data.optionIndex != null ? q?.options[data.optionIndex] : undefined
      const text = picked ?? data.text.slice(0, 200)
      if (!text) throw new Error('اكتب جوابك')
      value = { optionIndex: picked != null ? data.optionIndex : null, text }
    }
    await db
      .insert(answers)
      .values({
        roomId: room.id,
        playerId: player.id,
        questionIndex: data.index,
        ...value,
      })
      .onConflictDoNothing()

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(answers)
      .where(
        and(eq(answers.roomId, room.id), eq(answers.questionIndex, data.index)),
      )
    // Everyone answered (on a spin, the one player who had to): no need to wait for the timer
    if (round?.kind === 'spin' || count >= others.length + 1) {
      await db
        .update(rooms)
        .set({ phase: 'reveal', phaseEndsAt: later(REVEAL_SECONDS) })
        .where(
          and(
            eq(rooms.id, room.id),
            eq(rooms.phase, 'question'),
            eq(rooms.currentIndex, data.index),
          ),
        )
    }
    return { ok: true }
  })

export const reportScreenshot = createServerFn({ method: 'POST' })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const { room, player } = await authorize(data.code, data.token)
    await db
      .insert(events)
      .values({ roomId: room.id, playerId: player.id, type: 'screenshot' })
    return { ok: true }
  })

export const getMyResult = createServerFn({ method: 'POST' })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const { room, player: me } = await authorize(data.code, data.token)
    if (room.phase !== 'done') throw new Error('مازال ما كمّلتوش الأسئلة')
    const roster = await db
      .select()
      .from(players)
      .where(eq(players.roomId, room.id))
      .orderBy(asc(players.id))
    const partner = roster.find((p) => p.id !== me.id)
    if (!partner) throw new Error('ما فمّاش لاعب ثاني')
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
    const mode = asMode(room.mode)
    // Votes (anonymous counts) and the answers of the players the wheel picked
    const rounds = computeRounds(
      room.questionIds,
      roster,
      all,
      room.spins,
      room.joker,
    )
    // Three friends or more: a report on the whole group instead of one partner
    if (roster.length > 2) {
      return {
        kind: 'group' as const,
        mode,
        ...computeGroupReport(
          room.questionIds,
          roster.map((p) => ({
            id: p.id,
            name: p.name,
            gender: p.gender,
            answers: lite(p.id),
          })),
          me.id,
        ),
        ...rounds,
      }
    }
    const hasMarriage = room.questionIds.some(
      (id) => questionFor(id, null)?.marriage,
    )
    return {
      kind: 'pair' as const,
      mode,
      partnerName: partner.name,
      partnerGender: partner.gender as 'male' | 'female' | null,
      ...computeCompat(room.questionIds, lite(me.id), lite(partner.id), {
        mode,
        myGender: me.gender,
        partnerGender: partner.gender,
      }),
      marriage: hasMarriage
        ? computeMarriageReport(
            room.questionIds,
            { name: me.name, gender: me.gender, answers: lite(me.id) },
            {
              name: partner.name,
              gender: partner.gender,
              answers: lite(partner.id),
            },
          )
        : null,
      ...rounds,
    }
  })

/** Public info for the join screen: who is waiting and whether there is still a seat. */
export const getRoomPreview = createServerFn({ method: 'GET' })
  .validator(z.object({ code: codeSchema }))
  .handler(async ({ data }) => {
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, data.code))
      .limit(1)
    if (!room) return null
    const roster = await db
      .select({
        name: players.name,
        role: players.role,
        gender: players.gender,
      })
      .from(players)
      .where(eq(players.roomId, room.id))
    const host = roster.find((p) => p.role === 'host')
    const mode = asMode(room.mode)
    return {
      code: room.code,
      mode,
      hostName: host?.name ?? null,
      hostGender: (host?.gender ?? null) as 'male' | 'female' | null,
      players: roster.length,
      maxPlayers: MAX_PLAYERS[mode],
      // A friends room can't be joined once it started
      started: mode === 'friends' && room.phase !== 'waiting',
      full: roster.length >= MAX_PLAYERS[mode],
    }
  })
