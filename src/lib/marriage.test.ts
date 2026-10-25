import { describe, expect, it } from 'vitest'

import { computeCompat } from './compat'
import { computeMarriageReport } from './marriage'
import {
  MARRIAGE_QUESTIONS,
  QUESTIONS,
  getMarriageQuestion,
  getQuestion,
  pickQuestionIds,
  questionFor,
} from './questions'

describe('question bank', () => {
  it('has around 600 questions, each with 3 options and known traits', () => {
    expect(QUESTIONS.length + MARRIAGE_QUESTIONS.length).toBeGreaterThanOrEqual(580)
    const ids = new Set<string>()
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(3)
      for (const o of q.options) {
        for (const [k, v] of Object.entries(o.s)) {
          expect(['romance', 'adventure', 'jealousy', 'independence', 'humor', 'tradition', 'calm']).toContain(k)
          expect(v).toBeGreaterThan(0)
        }
      }
      expect(ids.has(q.id)).toBe(false)
      ids.add(q.id)
    }
  })

  it('gives each room 30 questions, the last 5 being the finale', () => {
    for (const mode of ['date', 'friends'] as const) {
      const ids = pickQuestionIds(mode)
      expect(ids).toHaveLength(30)
      expect(new Set(ids).size).toBe(30)
      for (const id of ids.slice(0, 25)) {
        expect(getQuestion(id)?.mode).toBe(mode)
        expect(questionFor(id, 'male')?.finale).toBe(false)
      }
      for (const id of ids.slice(-5)) expect(questionFor(id, 'male')?.finale).toBe(true)
    }
    for (const id of pickQuestionIds('date').slice(-5)) expect(getMarriageQuestion(id)).toBeDefined()
  })

  it('prefers questions the host has not seen yet', () => {
    const first = pickQuestionIds('date')
    const second = pickQuestionIds('date', first)
    expect(second.filter((id) => first.includes(id))).toHaveLength(0)
  })

  it('follows the other player gender for {صاحبك}', () => {
    const q = QUESTIONS.find((x) => x.text.includes('{صاحبك}'))!
    expect(questionFor(q.id, 'male', 'female')?.text).toContain('صاحبتك')
    expect(questionFor(q.id, 'male', 'male')?.text).not.toContain('{')
  })

  it('builds a friends note with the finale answers', () => {
    const ids = pickQuestionIds('friends')
    const answers = ids.map((_, i) => ({ questionIndex: i, optionIndex: i % 3, text: 'x' }))
    const r = computeCompat(ids, answers, answers, { mode: 'friends', partnerGender: 'female' })
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.finale).toHaveLength(5)
    expect(r.topics.length).toBeGreaterThan(0)
  })
})

describe('marriage questions', () => {
  it('have 3 options per gender', () => {
    for (const q of MARRIAGE_QUESTIONS) {
      expect(q.male.options).toHaveLength(3)
      expect(q.female.options).toHaveLength(3)
      expect(questionFor(q.id, 'female')?.options).toEqual(q.female.options.map((o) => o.t))
    }
  })

  it('compares both players topic by topic', () => {
    const qids = MARRIAGE_QUESTIONS.slice(0, 5).map((q) => q.id)
    const answers = (opts: number[]) =>
      opts.map((o, i) => ({ questionIndex: i, optionIndex: o, text: 'x' }))
    const r = computeMarriageReport(
      qids,
      { name: 'Amine', gender: 'male', answers: answers([0, 0, 0, 0, 0]) },
      { name: 'Sarra', gender: 'female', answers: answers([0, 1, 2, 0, 0]) },
    )
    expect(r.topics.map((t) => t.level)).toEqual(['same', 'close', 'far', 'same', 'same'])
    expect(r.harmony).toBe(70)
    expect(r.me.answers).toHaveLength(5)
    expect(r.partner.answers[2].line).toBe(MARRIAGE_QUESTIONS[2].female.options[2].a)
  })
})
