import { createServerFn } from '@tanstack/react-start'
import { and, eq, gt, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { answers, events, players, rooms } from '../../db/schema'
import { recordActivity } from './activity'
import { computeCompat } from './compat'
import { computeMarriageReport } from './marriage'
import {
  CATEGORY_LABEL,
  INTRO_SECONDS,
  QUESTION_SECONDS,
  REVEAL_SECONDS,
  pickQuestionIds,
  questionFor,
} from './questions'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ONLINE_MS = 9000

function makeCode() {
  let c = ''
  for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return c
}

const later = (s: number) => new Date(Date.now() + s * 1000)

const nameSchema = z.string().trim().min(1, 'اكتب اسمك').max(24)
const genderSchema = z.enum(['male', 'female'], { error: 'اختار إنتي راجل ولا مرا' })
const codeSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6}$/, 'الكود لازم يكون 6 حروف'))
const modeSchema = z.enum(['date', 'friends'])
const authSchema = z.object({ code: codeSchema, token: z.string().uuid() })

async function authorize(code: string, token: string) {
  const [row] = await db
    .select({ room: rooms, player: players })
    .from(players)
    .innerJoin(rooms, eq(players.roomId, rooms.id))
    .where(and(eq(players.token, token), eq(rooms.code, code)))
    .limit(1)
  if (!row) throw new Error('ما عندكش الحق تدخل للّعبة هذي')
  return row
}

/** Moves the room forward when a timer has expired. Conditional updates keep it race-safe. */
async function advance(room: typeof rooms.$inferSelect) {
  if (!room.phaseEndsAt || room.phaseEndsAt.getTime() > Date.now()) return
  const guard = and(
    eq(rooms.id, room.id),
    eq(rooms.phase, room.phase),
    eq(rooms.currentIndex, room.currentIndex),
  )
  if (room.phase === 'intro') {
    await db.update(rooms).set({ phase: 'question', phaseEndsAt: later(QUESTION_SECONDS) }).where(guard)
  } else if (room.phase === 'question') {
    await db.update(rooms).set({ phase: 'reveal', phaseEndsAt: later(REVEAL_SECONDS) }).where(guard)
  } else if (room.phase === 'reveal') {
    const next = room.currentIndex + 1
    if (next >= room.questionIds.length) {
      await db.update(rooms).set({ phase: 'done', phaseEndsAt: null }).where(guard)
    } else {
      await db
        .update(rooms)
        .set({ phase: 'question', currentIndex: next, phaseEndsAt: later(QUESTION_SECONDS) })
        .where(guard)
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
    }),
  )
  .handler(async ({ data }) => {
    const questionIds = pickQuestionIds(data.mode, data.seen)
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode()
      const [room] = await db
        .insert(rooms)
        .values({ code, mode: data.mode, questionIds })
        .onConflictDoNothing()
        .returning()
      if (!room) continue
      const token = crypto.randomUUID()
      await db.insert(players).values({ roomId: room.id, name: data.name, gender: data.gender, role: 'host', token })
      return { code, token, questionIds }
    }
    throw new Error('صار مشكل، عاود جرّب')
  })

export const joinRoom = createServerFn({ method: 'POST' })
  .validator(z.object({ name: nameSchema, gender: genderSchema, code: codeSchema }))
  .handler(async ({ data }) => {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, data.code)).limit(1)
    if (!room) throw new Error('الكود هذا غالط، ما فمّا حتى لعبة بيه')
    const token = crypto.randomUUID()
    const [inserted] = await db
      .insert(players)
      .values({ roomId: room.id, name: data.name, gender: data.gender, role: 'guest', token })
      .onConflictDoNothing()
      .returning()
    if (!inserted) throw new Error('اللعبة هذي كاملة، فيها زوز لاعبين ديجا')
    await db
      .update(rooms)
      .set({ phase: 'intro', phaseEndsAt: later(INTRO_SECONDS) })
      .where(and(eq(rooms.id, room.id), eq(rooms.phase, 'waiting')))
    return { code: room.code, token, questionIds: room.questionIds }
  })

export const getRoomState = createServerFn({ method: 'POST' })
  .validator(authSchema.extend({ sinceEventId: z.number().int().min(0).default(0) }))
  .handler(async ({ data }) => {
    const { room: initialRoom, player: me } = await authorize(data.code, data.token)
    await db.update(players).set({ lastSeenAt: new Date() }).where(eq(players.id, me.id))
    await recordActivity()
    await advance(initialRoom)

    const [room] = await db.select().from(rooms).where(eq(rooms.id, initialRoom.id))
    const roster = await db.select().from(players).where(eq(players.roomId, room.id))
    const partner = roster.find((p) => p.id !== me.id) ?? null
    const allAnswers = await db.select().from(answers).where(eq(answers.roomId, room.id))
    const partnerEvents = partner
      ? await db
          .select({ id: events.id, type: events.type, createdAt: events.createdAt })
          .from(events)
          .where(
            and(
              eq(events.roomId, room.id),
              eq(events.playerId, partner.id),
              gt(events.id, data.sinceEventId),
            ),
          )
      : []

    // Only questions that are already revealed expose both answers
    const revealedUpTo =
      room.phase === 'done'
        ? room.questionIds.length - 1
        : room.phase === 'reveal'
          ? room.currentIndex
          : room.currentIndex - 1
    const history: {
      index: number
      text: string
      category: string
      mine: string | null
      theirs: string | null
      // Marriage questions differ per gender; the partner's answer only shows in the final report
      marriage: boolean
      // The last 5 questions of the room, shown in their own colour
      finale: boolean
      same: boolean
    }[] = []
    for (let i = 0; i <= revealedUpTo && room.phase !== 'waiting'; i++) {
      const q = questionFor(room.questionIds[i], me.gender, partner?.gender)
      if (!q) continue
      const mine = allAnswers.find((a) => a.playerId === me.id && a.questionIndex === i)
      const theirs = partner
        ? allAnswers.find((a) => a.playerId === partner.id && a.questionIndex === i)
        : undefined
      history.push({
        index: i,
        text: q.text,
        category: CATEGORY_LABEL[q.cat],
        mine: mine?.text ?? null,
        theirs: q.marriage ? null : (theirs?.text ?? null),
        marriage: q.marriage,
        finale: q.finale,
        same:
          !q.marriage && mine?.optionIndex != null && mine.optionIndex === theirs?.optionIndex,
      })
    }

    let current = null
    if (room.phase === 'question') {
      const q = questionFor(room.questionIds[room.currentIndex], me.gender, partner?.gender)
      const mine = allAnswers.find(
        (a) => a.playerId === me.id && a.questionIndex === room.currentIndex,
      )
      const partnerAnswered = partner
        ? allAnswers.some((a) => a.playerId === partner.id && a.questionIndex === room.currentIndex)
        : false
      if (q) {
        current = {
          index: room.currentIndex,
          text: q.text,
          category: CATEGORY_LABEL[q.cat],
          options: q.options,
          marriage: q.marriage,
          finale: q.finale,
          myAnswer: mine?.text ?? null,
          partnerAnswered,
        }
      }
    }

    return {
      code: room.code,
      mode: room.mode as 'date' | 'friends',
      phase: room.phase as 'waiting' | 'intro' | 'question' | 'reveal' | 'done',
      index: room.currentIndex,
      total: room.questionIds.length,
      phaseEndsAt: room.phaseEndsAt?.toISOString() ?? null,
      serverNow: new Date().toISOString(),
      questionSeconds: QUESTION_SECONDS,
      me: { name: me.name, role: me.role, gender: me.gender },
      partner: partner
        ? {
            name: partner.name,
            gender: partner.gender,
            online: Date.now() - partner.lastSeenAt.getTime() < ONLINE_MS,
          }
        : null,
      current,
      history,
      partnerEvents: partnerEvents.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    }
  })

export const submitAnswer = createServerFn({ method: 'POST' })
  .validator(
    authSchema.extend({
      index: z.number().int().min(0),
      optionIndex: z.number().int().min(0).max(2).nullable(),
      text: z.string().trim().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const { room, player } = await authorize(data.code, data.token)
    if (room.phase !== 'question' || room.currentIndex !== data.index) {
      throw new Error('الوقت فات على السؤال هذا ⏱')
    }
    // The saved text is shown to the partner as is, so it's worded for their gender
    const [partner] = await db
      .select({ gender: players.gender })
      .from(players)
      .where(and(eq(players.roomId, room.id), ne(players.id, player.id)))
      .limit(1)
    const q = questionFor(room.questionIds[room.currentIndex], player.gender, partner?.gender)
    const picked = data.optionIndex != null ? q?.options[data.optionIndex] : undefined
    const text = picked ?? data.text
    await db
      .insert(answers)
      .values({
        roomId: room.id,
        playerId: player.id,
        questionIndex: data.index,
        optionIndex: picked != null ? data.optionIndex : null,
        text,
      })
      .onConflictDoNothing()

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(answers)
      .where(and(eq(answers.roomId, room.id), eq(answers.questionIndex, data.index)))
    if (count >= 2) {
      await db
        .update(rooms)
        .set({ phase: 'reveal', phaseEndsAt: later(REVEAL_SECONDS) })
        .where(
          and(eq(rooms.id, room.id), eq(rooms.phase, 'question'), eq(rooms.currentIndex, data.index)),
        )
    }
    return { ok: true }
  })

export const reportScreenshot = createServerFn({ method: 'POST' })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const { room, player } = await authorize(data.code, data.token)
    await db.insert(events).values({ roomId: room.id, playerId: player.id, type: 'screenshot' })
    return { ok: true }
  })

export const getMyResult = createServerFn({ method: 'POST' })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const { room, player: me } = await authorize(data.code, data.token)
    if (room.phase !== 'done') throw new Error('مازال ما كمّلتوش الأسئلة')
    const roster = await db.select().from(players).where(eq(players.roomId, room.id))
    const partner = roster.find((p) => p.id !== me.id)
    if (!partner) throw new Error('ما فمّاش لاعب ثاني')
    const all = await db.select().from(answers).where(eq(answers.roomId, room.id))
    const lite = (pid: number) =>
      all
        .filter((a) => a.playerId === pid)
        .map((a) => ({ questionIndex: a.questionIndex, optionIndex: a.optionIndex, text: a.text }))
    const hasMarriage = room.questionIds.some((id) => questionFor(id, null)?.marriage)
    const mode = room.mode as 'date' | 'friends'
    return {
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
            { name: partner.name, gender: partner.gender, answers: lite(partner.id) },
          )
        : null,
    }
  })

/** Public info for the join screen: who is waiting and whether there is still a seat. */
export const getRoomPreview = createServerFn({ method: 'GET' })
  .validator(z.object({ code: codeSchema }))
  .handler(async ({ data }) => {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, data.code)).limit(1)
    if (!room) return null
    const roster = await db
      .select({ name: players.name, role: players.role, gender: players.gender })
      .from(players)
      .where(eq(players.roomId, room.id))
    const host = roster.find((p) => p.role === 'host')
    return {
      code: room.code,
      mode: room.mode as 'date' | 'friends',
      hostName: host?.name ?? null,
      hostGender: (host?.gender ?? null) as 'male' | 'female' | null,
      full: roster.length >= 2,
    }
  })
