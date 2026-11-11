import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { aiSessions } from '../../db/schema'
import {
  aiQuestionFor,
  computeAiReport,
  openQuestionText,
  optionOrder,
  pickAiQuestions,
} from './ai'
import { writeLetter } from './ai-letter'
import { recordActivity } from './activity'
import { trafficSource } from './traffic'

const authSchema = z.object({
  id: z.number().int().positive(),
  token: z.string().uuid(),
})

type Session = typeof aiSessions.$inferSelect

async function authorizeAi(id: number, token: string): Promise<Session> {
  const [s] = await db
    .select()
    .from(aiSessions)
    .where(and(eq(aiSessions.id, id), eq(aiSessions.token, token)))
    .limit(1)
  if (!s) throw new Error('اللعبة هاذي موش موجودة')
  return s
}

const reportOf = (s: Session) =>
  computeAiReport({
    name: s.name,
    gender: s.gender,
    questionIds: s.questionIds,
    answers: s.answers,
    openId: s.openId,
    openAnswer: s.openAnswer,
  })

export const startAiSession = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().trim().min(1, 'اكتب اسمك').max(24),
      gender: z.enum(['male', 'female'], { error: 'اختار راجل ولا مرا' }),
      seen: z.array(z.string().max(40)).max(800).default([]),
      ref: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { questionIds, openId } = pickAiQuestions(data.seen)
    const token = crypto.randomUUID()
    const [s] = await db
      .insert(aiSessions)
      .values({
        token,
        name: data.name,
        gender: data.gender,
        questionIds,
        openId,
        source: trafficSource(data.ref, getRequestHeader('user-agent')),
      })
      .returning({ id: aiSessions.id })
    return { id: s.id, token, questionIds: [...questionIds, openId] }
  })

/** Everything the page needs: the questions (without scores), my answers, and whether it's over. */
export const getAiSession = createServerFn({ method: 'POST' })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const s = await authorizeAi(data.id, data.token)
    await recordActivity()
    const questions = s.questionIds.flatMap((id, index) => {
      const q = aiQuestionFor(id, s.gender)
      if (!q) return []
      return [
        {
          index,
          category: q.category,
          text: q.text,
          // Shuffled per game so the balanced answer isn't always in the same place
          options: optionOrder(s.id, index).map((i) => ({
            i,
            t: q.options[i],
          })),
        },
      ]
    })
    return {
      name: s.name,
      gender: s.gender as 'male' | 'female' | null,
      questions,
      answers: s.answers,
      open: openQuestionText(s.openId, s.gender),
      openAnswer: s.openAnswer,
      finished: !!s.finishedAt,
    }
  })

export const answerAi = createServerFn({ method: 'POST' })
  .validator(
    authSchema.extend({
      index: z.number().int().min(0),
      option: z.number().int().min(0).max(2),
    }),
  )
  .handler(async ({ data }) => {
    const s = await authorizeAi(data.id, data.token)
    if (s.finishedAt) throw new Error('كمّلت اللعبة، شوف التقرير متاعك')
    if (data.index >= s.questionIds.length) throw new Error('سؤال غالط')
    // Merged in SQL so two quick taps can't overwrite each other's answer
    await db
      .update(aiSessions)
      .set({
        answers: sql`${aiSessions.answers} || jsonb_build_object(${String(data.index)}::text, ${data.option}::int)`,
      })
      .where(eq(aiSessions.id, s.id))
    return { ok: true }
  })

/** Ends the game once every question is answered. The open answer is optional. */
export const finishAi = createServerFn({ method: 'POST' })
  .validator(
    authSchema.extend({ openAnswer: z.string().trim().max(1000).default('') }),
  )
  .handler(async ({ data }) => {
    const s = await authorizeAi(data.id, data.token)
    if (s.finishedAt) return { ok: true }
    const missing = s.questionIds.some((_, i) => s.answers[String(i)] == null)
    if (missing) throw new Error('مازالو أسئلة ما جاوبتش عليهم')
    await db
      .update(aiSessions)
      .set({ finishedAt: new Date(), openAnswer: data.openAnswer || null })
      .where(eq(aiSessions.id, s.id))
    return { ok: true }
  })

export const getAiReport = createServerFn({ method: 'POST' })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const s = await authorizeAi(data.id, data.token)
    if (!s.finishedAt) throw new Error('مازلت ما كمّلتش الأسئلة')
    const report = reportOf(s)
    return { ...report, letter: writeLetter(report, s.gender, s.id) }
  })
