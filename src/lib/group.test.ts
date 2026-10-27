import { describe, expect, it } from 'vitest'

import { computeGroupReport, computeRounds } from './group'
import {
  QUESTIONS,
  getQuestion,
  otherSpin,
  othersGender,
  personalize,
  pickQuestionIds,
  questionFor,
  roundFor,
  withoutVotes,
} from './questions'

// An older friends room: 25 questions and the 5 "الصراحة" finale
const qids = [
  ...withoutVotes(pickQuestionIds('friends')).slice(0, 25),
  ...['saraha_0', 'saraha_1', 'saraha_2', 'saraha_3', 'saraha_4'],
]
const answersFor = (pick: (i: number) => number) =>
  qids.map((id, i) => ({ questionIndex: i, optionIndex: pick(i), text: getQuestion(id)!.options[pick(i)].t }))

// Ali and Sami always pick the same answer; Mona always differs from them; Rim agrees with everyone half the time
const members = [
  { id: 1, name: 'Ali', gender: 'male', answers: answersFor(() => 0) },
  { id: 2, name: 'Sami', gender: 'male', answers: answersFor(() => 0) },
  { id: 3, name: 'Mona', gender: 'female', answers: answersFor(() => 2) },
  { id: 4, name: 'Rim', gender: 'female', answers: answersFor((i) => (i % 2 ? 0 : 2)) },
]

describe('group report', () => {
  const report = computeGroupReport(qids, members, 1)

  it('puts the player first and ranks their friends by closeness', () => {
    expect(report.members.map((m) => m.name)).toEqual(['Ali', 'Sami', 'Mona', 'Rim'])
    expect(report.members[0].me).toBe(true)
    expect(report.friends[0].name).toBe('Sami')
    expect(report.friends[0].same).toBe(30)
    expect(report.friends.at(-1)!.name).toBe('Mona')
  })

  it('scores every pair once, closest first', () => {
    expect(report.pairs).toHaveLength(6)
    expect([report.pairs[0].a.name, report.pairs[0].b.name].sort()).toEqual(['Ali', 'Sami'])
    expect(report.pairs[0].score).toBeGreaterThan(report.pairs.at(-1)!.score)
  })

  it('shows who picked the same answer as who', () => {
    expect(report.splits.length).toBeGreaterThan(0)
    for (const q of report.splits) {
      const names = q.groups.flatMap((g) => g.people.map((p) => p.name)).sort()
      expect(names).toEqual(['Ali', 'Mona', 'Rim', 'Sami'])
      expect(q.groups.some((g) => g.people.some((p) => p.name === 'Ali') && g.people.some((p) => p.name === 'Sami'))).toBe(true)
    }
    // Mona never agrees with Ali and Sami, so the group never answers as one
    expect(report.agreed).toHaveLength(0)
  })

  it('gives each member at most one title', () => {
    const names = report.titles.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("lists everyone's finale answers", () => {
    expect(report.finale).toHaveLength(5)
    for (const f of report.finale) expect(f.answers).toHaveLength(4)
  })
})

describe('votes and spins', () => {
  const ids = pickQuestionIds('friends')
  const roster = [
    { id: 1, name: 'Ali', gender: 'male' },
    { id: 2, name: 'Sami', gender: 'male' },
    { id: 3, name: 'Mona', gender: 'female' },
  ]
  const firstVote = ids.findIndex((id) => roundFor(id)?.kind === 'vote')
  const [spinA, spinB] = ids.flatMap((id, i) => (roundFor(id)?.kind === 'spin' ? [i] : []))
  const all = [
    // Ali and Sami vote for Mona, Mona votes for Ali
    { playerId: 1, questionIndex: firstVote, voteFor: 3, text: 'Mona' },
    { playerId: 2, questionIndex: firstVote, voteFor: 3, text: 'Mona' },
    { playerId: 3, questionIndex: firstVote, voteFor: 1, text: 'Ali' },
    { playerId: 2, questionIndex: spinA, voteFor: null, text: 'سرّ سامي' },
  ]
  // The wheel picked Sami for both questions; he swapped the second one with the joker
  const rounds = computeRounds(ids, roster, all, { [spinA]: 2, [spinB]: 2 }, { index: spinB, skipped: 'spin_0' })

  it('counts votes without saying who voted for who', () => {
    expect(rounds.votes).toHaveLength(1)
    expect(rounds.votes[0].results).toEqual([
      { name: 'Mona', gender: 'female', votes: 2 },
      { name: 'Ali', gender: 'male', votes: 1 },
    ])
  })

  it("shows the spun player's answers and the question swapped with the joker", () => {
    expect(rounds.spins.map((s) => [s.player?.name, s.answer])).toEqual([
      ['Sami', 'سرّ سامي'],
      ['Sami', null],
    ])
    expect(rounds.spins[0].skipped).toBeNull()
    expect(rounds.spins[1].skipped).toBe(roundFor('spin_0')!.text)
  })

  it('gives the joker a spin question the room does not have yet', () => {
    for (let n = 0; n < 20; n++) {
      const next = otherSpin(ids)!
      expect(roundFor(next)?.kind).toBe('spin')
      expect(ids).not.toContain(next)
    }
  })
})

describe('othersGender', () => {
  it('is plural for a group, otherwise the gender of the other player', () => {
    expect(othersGender(['female', 'female'])).toBe('group')
    expect(othersGender(['female'])).toBe('female')
    expect(othersGender(['male'])).toBe('male')
    expect(othersGender([])).toBe('male')
  })
})

describe('group wording', () => {
  // Every word about the other player(s) in a friends question has a plural form for groups
  const core = QUESTIONS.filter((q) => q.mode === 'friends' && q.cat !== 'saraha')

  it('has a plural form in every friends question', () => {
    const missing = core.flatMap((q) =>
      [q.text, ...q.options.map((o) => o.t)].flatMap((t) =>
        [...t.matchAll(/\{([^@{}][^{}]*)\}/g)]
          .map((m) => m[1])
          .filter((body) => body !== 'صاحبك' && body.split('|').length !== 3)
          .map((body) => `${q.id}: {${body}}`),
      ),
    )
    expect(missing).toEqual([])
  })

  it('talks about صحابك in a group', () => {
    const q = core.find((x) => x.text.includes('{صاحبك}'))!
    const view = questionFor(q.id, 'male', 'group')!
    expect(view.text).toContain('صحابك')
    expect(view.text).not.toMatch(/[{}|]/)
    expect(personalize('{هو|هي|هوما} {@متأكّد|متأكّدة}', 'female', 'group')).toBe('هوما متأكّدة')
    expect(personalize('{هو|هي|هوما}', 'male', 'female')).toBe('هي')
  })
})
