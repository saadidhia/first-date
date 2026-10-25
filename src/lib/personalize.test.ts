import { describe, expect, it } from 'vitest'
import { personalize, QUESTIONS, questionFor } from './questions'

describe('personalize', () => {
  it('words the partner by their gender', () => {
    const t = '{شريكك} {يخلّص|تخلّص} عليك ديما؟'
    expect(personalize(t, 'female', 'male')).toBe('شريكك يخلّص عليك ديما؟')
    expect(personalize(t, 'male', 'female')).toBe('شريكتك تخلّص عليك ديما؟')
  })

  it('words the player by their own gender', () => {
    const t = 'نكون {@متأكّد|متأكّدة} وما {نقلّو|نقلّها}ش'
    expect(personalize(t, 'female', 'male')).toBe('نكون متأكّدة وما نقلّوش')
    expect(personalize(t, 'male', 'female')).toBe('نكون متأكّد وما نقلّهاش')
  })

  it('falls back to the masculine form', () => {
    expect(personalize('{صاحبك} {يجي|تجي}', null, null)).toBe('صاحبك يجي')
  })

  it('leaves no placeholder behind in the whole bank', () => {
    for (const q of QUESTIONS) {
      for (const [g, pg] of [
        ['male', 'female'],
        ['female', 'male'],
        ['female', 'female'],
      ]) {
        const v = questionFor(q.id, g, pg)!
        for (const s of [v.text, ...v.options]) expect(s, q.id).not.toMatch(/[{}|]/)
      }
    }
  })
})
