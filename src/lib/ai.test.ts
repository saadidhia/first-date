import { describe, expect, it } from 'vitest'

import {
  AI_OPEN_IDS,
  AI_PER_DIM,
  AI_QUESTIONS,
  DIM_ORDER,
  DIMS,
  computeAiReport,
  getAiQuestion,
  openQuestionText,
  optionOrder,
  pickAiQuestions,
} from './ai'
import { writeLetter } from './ai-letter'
import { personalize } from './questions'

const balancedIndex = (id: string) =>
  getAiQuestion(id)!.options.findIndex((o) => o.points === 2)
const worstIndex = (id: string, pole: 'a' | 'b') =>
  getAiQuestion(id)!.options.findIndex((o) => o.pole === pole)

describe('AI question bank', () => {
  it('has 12 questions per dimension with unique ids', () => {
    for (const dim of DIM_ORDER) {
      expect(AI_QUESTIONS.filter((q) => q.dim === dim)).toHaveLength(12)
    }
    expect(new Set(AI_QUESTIONS.map((q) => q.id)).size).toBe(AI_QUESTIONS.length)
  })

  it('every question has one balanced answer and leans both ways', () => {
    for (const q of AI_QUESTIONS) {
      expect(q.options).toHaveLength(3)
      expect(q.options.filter((o) => o.points === 2), q.id).toHaveLength(1)
      const poles = new Set(q.options.map((o) => o.pole).filter(Boolean))
      expect([...poles].sort(), q.id).toEqual(['a', 'b'])
    }
  })

  it('leaves no gender placeholder behind, for both genders', () => {
    const texts = [
      ...AI_QUESTIONS.flatMap((q) => [q.text, ...q.options.map((o) => o.t)]),
      ...AI_OPEN_IDS.map((id) => openQuestionText(id, null)!),
      ...DIM_ORDER.flatMap((d) => {
        const i = DIMS[d]
        return [i.title, i.strong, ...(['a', 'b'] as const).flatMap((p) => [i[p].name, i[p].seen, i[p].why, ...i[p].tips])]
      }),
    ]
    for (const t of texts) {
      for (const gender of ['male', 'female']) {
        expect(personalize(t, gender, null)).not.toMatch(/[{}|]/)
      }
    }
  })
})

describe('pickAiQuestions', () => {
  it('picks the same number from every topic, never the same topic twice in a row', () => {
    for (let run = 0; run < 50; run++) {
      const { questionIds, openId } = pickAiQuestions()
      expect(questionIds).toHaveLength(DIM_ORDER.length * AI_PER_DIM)
      expect(new Set(questionIds).size).toBe(questionIds.length)
      const dims = questionIds.map((id) => getAiQuestion(id)!.dim)
      for (const d of DIM_ORDER) expect(dims.filter((x) => x === d)).toHaveLength(AI_PER_DIM)
      for (let i = 1; i < dims.length; i++) expect(dims[i]).not.toBe(dims[i - 1])
      expect(AI_OPEN_IDS).toContain(openId)
    }
  })

  it('brings unseen questions first', () => {
    const first = pickAiQuestions().questionIds
    const second = pickAiQuestions(first).questionIds
    expect(second.filter((id) => first.includes(id))).toHaveLength(0)
  })

  it('shuffles options the same way for the same game', () => {
    expect(optionOrder(7, 3)).toEqual(optionOrder(7, 3))
    expect([...optionOrder(7, 3)].sort()).toEqual([0, 1, 2])
  })
})

describe('computeAiReport', () => {
  const { questionIds } = pickAiQuestions()
  const answersWith = (pick: (id: string) => number) =>
    Object.fromEntries(questionIds.map((id, i) => [String(i), pick(id)]))

  it('a fully balanced player scores 100 everywhere and has nothing to work on', () => {
    const r = computeAiReport({
      name: 'سارة',
      gender: 'female',
      questionIds,
      answers: answersWith(balancedIndex),
    })
    expect(r.balance).toBe(100)
    expect(r.workOn).toHaveLength(0)
    expect(r.strengths.length).toBeGreaterThan(0)
  })

  it('names the pattern, quotes the answers and gives tips', () => {
    // Keeps feelings in on every emotions question, balanced elsewhere
    const r = computeAiReport({
      name: 'أمين',
      gender: 'male',
      questionIds,
      answers: answersWith((id) =>
        getAiQuestion(id)!.dim === 'mach' ? worstIndex(id, 'a') : balancedIndex(id),
      ),
      openId: 'ai_open_0',
      openAnswer: 'نحب نولّي نحكي أكثر',
    })
    expect(r.workOn).toHaveLength(1)
    const w = r.workOn[0]
    expect(w.dim).toBe('mach')
    expect(w.lean).toBe('a')
    expect(w.leanName).toBe('تكتم مشاعرك')
    expect(w.evidence).toHaveLength(AI_PER_DIM)
    expect(w.tips.length).toBeGreaterThan(0)
    expect(w.otherName).toBeNull()
    expect(r.open?.answer).toBe('نحب نولّي نحكي أكثر')
  })

  it('notices answers that go both ways', () => {
    let n = 0
    const r = computeAiReport({
      name: 'x',
      gender: 'male',
      questionIds,
      answers: answersWith((id) =>
        getAiQuestion(id)!.dim === 'sira3'
          ? worstIndex(id, n++ % 2 ? 'a' : 'b')
          : balancedIndex(id),
      ),
    })
    expect(r.workOn[0].dim).toBe('sira3')
    expect(r.workOn[0].mixed).toBe(true)
    expect(r.workOn[0].otherName).toBeTruthy()
  })
})

describe('writeLetter', () => {
  const { questionIds } = pickAiQuestions()
  const answersWith = (pick: (id: string) => number) =>
    Object.fromEntries(questionIds.map((id, i) => [String(i), pick(id)]))
  const leanOn = (dims: Record<string, 'a' | 'b'>) =>
    answersWith((id) => {
      const pole = dims[getAiQuestion(id)!.dim]
      return pole ? worstIndex(id, pole) : balancedIndex(id)
    })

  it('links patterns, quotes an answer, replies to the open answer, for both genders', () => {
    for (const gender of ['male', 'female']) {
      const report = computeAiReport({
        name: 'ريم',
        gender,
        questionIds,
        // Keeps feelings in + stays quiet to please: a known link
        answers: leanOn({ mach: 'a', sira3: 'a' }),
        openId: 'ai_open_1',
        openAnswer: 'نخاف نقعد وحدي',
      })
      const letter = writeLetter(report, gender, 3)
      const all = letter.join('\n')
      expect(letter[0].startsWith('ريم،')).toBe(true)
      expect(all).toContain('تبلع مع الناس وتبلع مع روحك')
      expect(all).toContain(`«${report.workOn[0].evidence[0].answer}»`)
      expect(all).toContain('«نخاف نقعد وحدي»')
      expect(all).toContain(report.workOn[0].tips[0])
      expect(all).not.toMatch(/[{}|]|undefined/)
      expect(writeLetter(report, gender, 3)).toEqual(letter)
    }
  })

  it('calls out answers that are all balanced', () => {
    const report = computeAiReport({
      name: 'x',
      gender: 'male',
      questionIds,
      answers: answersWith(balancedIndex),
    })
    expect(writeLetter(report, 'male', 0).join(' ')).toContain('جاوبت باللي يبان باهي')
  })

  it('every link and mirror reads cleanly for both genders', () => {
    // Every pattern on at once: exercises every LINK/MIRROR that can apply
    for (const pole of ['a', 'b'] as const) {
      const dims = Object.fromEntries(DIM_ORDER.map((d) => [d, pole]))
      for (const gender of ['male', 'female']) {
        const report = computeAiReport({ name: 'x', gender, questionIds, answers: leanOn(dims) })
        expect(writeLetter(report, gender, 1).join(' ')).not.toMatch(/[{}|]|undefined/)
      }
    }
  })
})
