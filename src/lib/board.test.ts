import { describe, expect, it } from 'vitest'

import { BOARD_EASY, BOARD_HARD, BOARD_MEDIUM } from './bank/board'
import {
  FRIENDS_DARES,
  FRIENDS_EASY,
  FRIENDS_HARD,
  FRIENDS_MEDIUM,
} from './bank/board-friends'
import {
  ANSWER_SECONDS,
  MIC_PENALTY,
  OBSTACLES,
  MIC_SECONDS,
  REVEAL_SECONDS,
  type BoardState,
  EFFECT,
  LAST,
  MAX_TURNS,
  ROLL_SECONDS,
  SQUARES,
  answerQuestion,
  applyRoll,
  boardQuestion,
  initBoard,
  obstacleText,
  pickBoardQuestion,
  squareFor,
  tick,
  tierAt,
  trackMic,
  verdict,
} from './board'

const people = new Map([
  [1, { id: 1, name: 'سارة', gender: 'female' }],
  [2, { id: 2, name: 'أحمد', gender: 'male' }],
  [3, { id: 3, name: 'نور', gender: 'female' }],
])
const rand = () => 0
const T0 = 1_000_000

/** The player who rolled keeps the mic on for `seconds`, seen by a poll every second. */
const micOnFor = (s: BoardState, seconds: number) => {
  for (let t = 0; t <= seconds; t++) s = trackMic(s, true, T0 + t * 1000)
  return s
}

const at = (s: BoardState, pos: number, key = 'team'): BoardState => ({
  ...s,
  pos: { ...s.pos, [key]: pos },
})

describe('the board', () => {
  it('runs from التعارف to العرس with questions, fights, the aunt and milestones', () => {
    expect(SQUARES).toHaveLength(48)
    expect(SQUARES[0].kind).toBe('start')
    expect(SQUARES[LAST].kind).toBe('end')
    expect(SQUARES[13].kind).toBe('aunt')
    expect(SQUARES[19].kind).toBe('fight')
    expect(SQUARES[24].name).toBe('الخطوبة')
    expect(SQUARES.filter((s) => s.kind === 'question').length).toBeGreaterThan(
      15,
    )
  })

  it('every question has text and exactly 3 options, at every level', () => {
    for (const bank of [BOARD_EASY, BOARD_MEDIUM, BOARD_HARD]) {
      expect(bank.length).toBeGreaterThanOrEqual(20)
      for (const q of bank) {
        expect(q).toHaveLength(4)
        q.forEach((t) => expect(t.trim().length).toBeGreaterThan(0))
      }
    }
    for (const bank of [FRIENDS_EASY, FRIENDS_MEDIUM, FRIENDS_HARD]) {
      expect(bank.length).toBeGreaterThanOrEqual(14)
      for (const [text, ...options] of bank) {
        expect(text).toContain('{name}')
        expect(options).toHaveLength(3)
        // Every question has a kind answer and a roast
        expect(options.some(([, m]) => m > 0)).toBe(true)
        expect(options.some(([, m]) => m < 0)).toBe(true)
      }
    }
    FRIENDS_DARES.forEach((d) => expect(d).toContain('{name}'))
    expect(boardQuestion('board_m_0')?.options).toHaveLength(3)
    expect(boardQuestion('board_x_0')).toBeNull()
    expect(boardQuestion('board_e_999')).toBeNull()
  })

  it('gets harder towards the wedding, and a fight is always hard', () => {
    expect(tierAt(3, 'question')).toBe('e')
    expect(tierAt(20, 'question')).toBe('m')
    expect(tierAt(35, 'question')).toBe('h')
    expect(tierAt(19, 'fight')).toBe('h')
  })

  it("picks questions the room hasn't had yet", () => {
    const asked = BOARD_EASY.slice(1).map((_, i) => `board_e_${i + 1}`)
    expect(pickBoardQuestion('e', asked, () => 0.99)).toBe('board_e_0')
  })
})

describe('a couple', () => {
  const start = () => initBoard([1, 2], true, T0)

  it('takes turns rolling and shares one position', () => {
    let s = applyRoll(start(), 2, T0, people, rand)
    expect(s.pos.team).toBe(2)
    expect(s.step).toBe('roll')
    expect(s.order[s.turn]).toBe(2)
    s = applyRoll(s, 4, T0, people, rand)
    expect(s.pos.team).toBe(6)
    expect(s.order[s.turn]).toBe(1)
  })

  it('moves forward on the same answer and back on different ones', () => {
    let s = applyRoll(start(), 3, T0, people, rand)
    expect(s.step).toBe('question')
    expect(s.question?.id).toMatch(/^board_e_/)
    s = answerQuestion(s, 1, 0, T0, people)
    expect(s.step).toBe('question')
    s = answerQuestion(s, 2, 0, T0, people)
    expect(s.step).toBe('roll')
    expect(s.pos.team).toBe(3 + EFFECT.questionSame)
    expect(s.reveal?.matched).toBe(true)

    let d = applyRoll(start(), 3, T0, people, rand)
    d = answerQuestion(d, 1, 0, T0, people)
    d = answerQuestion(d, 2, 1, T0, people)
    expect(d.pos.team).toBe(3 + EFFECT.questionDiff)
    expect(d.reveal?.matched).toBe(false)
  })

  it('a fight costs more when you disagree', () => {
    let s = applyRoll(at(start(), 15), 4, T0, people, rand)
    expect(s.question?.kind).toBe('fight')
    expect(s.question?.id).toMatch(/^board_h_/)
    s = answerQuestion(s, 1, 2, T0, people)
    s = answerQuestion(s, 2, 0, T0, people)
    expect(s.pos.team).toBe(19 + EFFECT.fightDiff)
  })

  it('a 🚧 obstacle sends the couple back 2, a different one each time', () => {
    const s = applyRoll(at(start(), 10), 3, T0, people, rand)
    expect(s.roll?.to).toBe(13)
    expect(s.pos.team).toBe(13 + EFFECT.aunt)
    expect(squareFor(13, true).name).toBe('عقبة')
    // rand 0 picks the first obstacle, about the first of the two
    expect(s.obstacle).toEqual({
      seq: s.roll!.seq,
      text: '👴 بو سارة موش موافق!',
    })
    expect(s.log[0].text).toContain('بو سارة موش موافق')
    const texts = new Set(
      OBSTACLES.map((_, i) => obstacleText(i, ['سارة', 'أحمد'], () => 0.9)),
    )
    expect(texts.size).toBe(OBSTACLES.length)
    for (const t of texts) expect(t).not.toMatch(/[{}]/)
  })

  it('wins on reaching the wedding, even past it', () => {
    const s = applyRoll(at(start(), 44), 6, T0, people, rand)
    expect(s.pos.team).toBe(LAST)
    expect(s.step).toBe('done')
    expect(s.result).toMatchObject({ won: true, turns: 1 })
  })

  it(`loses after ${MAX_TURNS} rolls without reaching it`, () => {
    let s = start()
    for (let i = 0; i < MAX_TURNS; i++) {
      s = at(s, 0)
      s = applyRoll(s, 2, T0, people, rand)
    }
    expect(s.step).toBe('done')
    expect(s.result).toMatchObject({ won: false, turns: MAX_TURNS })
  })

  it('rolls by itself, and closes a question, when time runs out', () => {
    let s = start()
    expect(tick(s, T0 + 1000, people, rand)).toBe(s)
    s = tick(s, T0 + ROLL_SECONDS * 1000, people, () => 0.4)
    expect(s.rolls).toBe(1)
    expect(s.pos.team).toBe(3)
    expect(s.step).toBe('question')
    s = answerQuestion(s, 1, 0, s.endsAt - 1, people)
    s = tick(s, s.endsAt + ANSWER_SECONDS * 1000, people, rand)
    expect(s.step).toBe('roll')
    expect(s.reveal?.matched).toBe(false)
    expect(s.pos.team).toBe(3 + EFFECT.questionDiff)
  })

  it('gives everyone time to read the answers before the next roll', () => {
    let s = applyRoll(start(), 3, T0, people, rand)
    s = answerQuestion(s, 1, 0, T0, people)
    s = answerQuestion(s, 2, 0, T0, people)
    expect(s.holdUntil).toBe(T0 + REVEAL_SECONDS * 1000)
    // Too early: nothing happens, not even when the roll times out during the pause
    expect(applyRoll(s, 4, T0 + 1000, people, rand)).toBe(s)
    expect(s.endsAt).toBe(T0 + (REVEAL_SECONDS + ROLL_SECONDS) * 1000)
    const after = applyRoll(s, 4, s.holdUntil!, people, rand)
    expect(after.pos.team).toBe(5 + 4)
  })

  it('ignores a second answer and answers from outside the room', () => {
    let s = applyRoll(start(), 3, T0, people, rand)
    s = answerQuestion(s, 1, 0, T0, people)
    expect(answerQuestion(s, 1, 2, T0, people)).toBe(s)
    expect(answerQuestion(s, 99, 0, T0, people)).toBe(s)
  })
})

describe('friends racing', () => {
  const start = () => initBoard([1, 2, 3], false, T0)

  it('each has a pawn and the turn goes round', () => {
    let s = applyRoll(start(), 2, T0, people, rand)
    expect(s.pos).toEqual({ '1': 2, '2': 0, '3': 0 })
    s = applyRoll(s, 4, T0, people, rand)
    expect(s.pos['2']).toBe(4)
    expect(s.order[s.turn]).toBe(3)
  })

  it("the player who rolled doesn't answer: the friends decide", () => {
    let s = applyRoll(start(), 3, T0, people, rand)
    expect(s.question?.kind).toBe('question')
    expect(s.question?.id).toBe('fq_e_0')
    // fq_e_0's options move the roller +2, −1, +1
    expect(answerQuestion(s, 1, 0, T0, people)).toBe(s)
    s = answerQuestion(s, 2, 0, T0, people)
    expect(s.step).toBe('question')
    s = answerQuestion(s, 3, 0, T0, people)
    expect(s.step).toBe('roll')
    // Both friends picked the +2 answer: their points add up
    expect(s.pos['1']).toBe(3 + 2 + 2)
    expect(s.pos['2']).toBe(0)
  })

  it('a roast sends the roller back', () => {
    let s = applyRoll(start(), 3, T0, people, rand)
    s = answerQuestion(s, 2, 1, T0, people)
    s = answerQuestion(s, 3, 1, T0, people)
    expect(s.pos['1']).toBe(3 - 1 - 1)
    expect(s.reveal?.matched).toBe(false)
  })

  it('the ⚡ squares are dares the friends rate', () => {
    let s = applyRoll(at(start(), 15, '1'), 4, T0, people, rand)
    expect(s.question?.kind).toBe('dare')
    expect(s.question?.id).toBe('fd_0')
    const q = boardQuestion('fd_0', 'male', { name: 'سارة', gender: 'female' })
    expect(q?.text).toContain('سارة')
    expect(q?.moves).toEqual([2, 1, -1])
    s = micOnFor(s, MIC_SECONDS)
    s = answerQuestion(s, 2, 0, T0, people)
    s = answerQuestion(s, 3, 1, T0, people)
    expect(s.pos['1']).toBe(19 + 2 + 1)
  })

  it('a dare without the mic on for 5 seconds costs −2, whatever the votes', () => {
    let s = applyRoll(at(start(), 15, '1'), 4, T0, people, rand)
    s = micOnFor(s, MIC_SECONDS - 2)
    s = answerQuestion(s, 2, 0, T0, people)
    s = answerQuestion(s, 3, 0, T0, people)
    expect(s.reveal?.noMic).toBe(true)
    expect(s.pos['1']).toBe(19 + MIC_PENALTY)
    expect(s.log[0].text).toContain('المايك')
  })

  it('counts mic time only while someone is looking, and only on dares', () => {
    let s = applyRoll(at(start(), 15, '1'), 4, T0, people, rand)
    s = trackMic(s, true, T0)
    s = trackMic(s, true, T0 + 1000)
    // A gap of 10 s when nobody looked doesn't count
    s = trackMic(s, true, T0 + 11_000)
    expect(s.question?.micMs).toBe(1000)
    expect(trackMic(s, false, T0 + 12_000)).toBe(s)
    const question = applyRoll(start(), 3, T0, people, rand)
    expect(trackMic(question, true, T0)).toBe(question)
  })

  it('words a friends question for the player who rolled', () => {
    const q = boardQuestion('fq_e_1', 'male', { name: 'نور', gender: 'female' })
    expect(q?.text).toContain('نور')
    expect(q?.text).toContain('تعمل')
    expect(q?.options).toHaveLength(3)
  })

  it('leaves no {…} unworded, for a man or a woman', () => {
    const ids = [
      ...FRIENDS_EASY.map((_, i) => `fq_e_${i}`),
      ...FRIENDS_MEDIUM.map((_, i) => `fq_m_${i}`),
      ...FRIENDS_HARD.map((_, i) => `fq_h_${i}`),
      ...FRIENDS_DARES.map((_, i) => `fd_${i}`),
    ]
    for (const id of ids)
      for (const gender of ['male', 'female']) {
        const q = boardQuestion(id, 'male', { name: 'X', gender })!
        for (const t of [q.text, ...q.options]) expect(t).not.toMatch(/[{}]/)
      }
  })

  it('is ملك القعدة: friends stops, a throne at the end, and no square that sends you back', () => {
    for (let i = 0; i <= LAST; i++)
      expect(squareFor(i, false).kind).not.toBe('aunt')
    expect(squareFor(8, false).name).toBe('القهوة')
    expect(squareFor(LAST, false).name).toBe('الكرسي')
    expect(squareFor(19, false).icon).toBe('🎤')
    // The couple's road is unchanged
    expect(squareFor(13, true).kind).toBe('aunt')
    expect(squareFor(24, true).name).toBe('الخطوبة')

    // 10 + 3 lands on 13: عمّتو for a couple, a question for friends
    const s = applyRoll(at(start(), 10, '1'), 3, T0, people, rand)
    expect(s.pos['1']).toBe(13)
    expect(s.question?.kind).toBe('question')
    const stop = applyRoll(at(start(), 5, '1'), 3, T0, people, rand)
    expect(stop.log[0].text).toContain('للقهوة')
  })

  it('crowns the first to arrive, and plays on until everyone is there', () => {
    // Sara (1) reaches the throne first: she's crowned, the game goes on
    let s = applyRoll(at(start(), 44, '1'), 6, T0, people, rand)
    expect(s.finished).toEqual([1])
    expect(s.log[0].text).toContain('ملكة القعدة')
    expect(s.step).toBe('roll')
    expect(s.order[s.turn]).toBe(2)
    // Ahmed (2) arrives second; Nour (3) is next, and Sara is skipped from now on
    s = applyRoll(at(s, 45, '2'), 4, T0, people, rand)
    expect(s.finished).toEqual([1, 2])
    expect(s.log[0].text).toContain('الثاني')
    expect(s.order[s.turn]).toBe(3)
    s = applyRoll(at(s, 10, '3'), 2, T0, people, rand)
    expect(s.step).toBe('roll')
    expect(s.order[s.turn]).toBe(3)
    // The last one arrives: the game ends with everyone ranked in order of arrival
    s = applyRoll(at(s, 43, '3'), 5, T0, people, rand)
    expect(s.step).toBe('done')
    expect(s.result).toMatchObject({ winner: 1, ranking: [1, 2, 3] })
    expect(s.log[0].text).toContain('وصلو الكل')
  })

  it('friends who arrived still vote on the others', () => {
    let s = applyRoll(at(start(), 44, '1'), 6, T0, people, rand)
    s = applyRoll(s, 3, T0, people, rand)
    expect(s.question?.by).toBe(2)
    s = answerQuestion(s, 3, 0, T0, people)
    expect(s.step).toBe('question')
    s = answerQuestion(s, 1, 0, T0, people)
    expect(s.step).toBe('roll')
  })

  it('adds up every friend’s vote', () => {
    expect(verdict([0, 0, 1], [2, -1, 1])).toBe(3)
    expect(verdict([0, 1], [2, -1, 1])).toBe(1)
    expect(verdict([1, 1], [2, -1, 1])).toBe(-2)
    expect(verdict([], [2, -1, 1])).toBe(0)
  })

  it('a roast is not always a loss', () => {
    const all = [FRIENDS_EASY, FRIENDS_MEDIUM, FRIENDS_HARD].flat()
    // The questions don't share one pattern of points
    const patterns = new Set(
      all.map(([, ...o]) => o.map(([, m]) => m).join(',')),
    )
    expect(patterns.size).toBeGreaterThan(3)
  })

  it('after the last round, the furthest one wins', () => {
    let s = start()
    for (let i = 0; i < MAX_TURNS * 3; i++) {
      // Keep everyone off the wedding so the rounds run out, with 2 always in front
      s = { ...s, pos: { '1': 0, '2': 10, '3': 0 } }
      s = applyRoll(s, 2, T0, people, rand)
      if (s.step === 'question') s = tick(s, s.endsAt, people, rand)
    }
    expect(s.step).toBe('done')
    expect(s.result?.winner).toBe(2)
  })
})
