import { type AnswerLite, TRAITS, computeCompat, traitLabel, vectorFor } from './compat'
import { getQuestion, othersGender, personalize, questionFor, roundFor } from './questions'

export type Member = { id: number; name: string; gender: string | null; answers: AnswerLite[] }

type Person = { name: string; gender: 'male' | 'female' | null }

export type GroupReport = {
  /** Everyone in the room, me first */
  members: (Person & { me: boolean })[]
  /** How close I am to each friend, closest first */
  friends: (Person & { score: number; same: number; together: number })[]
  /** Every pair in the group, closest first */
  pairs: { a: Person; b: Person; score: number }[]
  /** One title per member, from the trait they lead the group in */
  titles: (Person & { title: string })[]
  /** Questions where everyone picked the same answer */
  agreed: { question: string; answer: string }[]
  /** Questions where nobody else picked my answer */
  alone: { question: string; answer: string }[]
  /** Who picked the same thing as who, on the questions that split the group the most */
  splits: { question: string; groups: { answer: string; people: Person[] }[] }[]
  /** Everyone's answers to the "الصراحة" finale */
  finale: { question: string; answers: (Person & { text: string | null })[] }[]
}

const person = (m: Member): Person => ({
  name: m.name,
  gender: m.gender === 'female' ? 'female' : m.gender === 'male' ? 'male' : null,
})

/**
 * The end-of-game report for a friends room with 3 or more players, as `meId` sees it:
 * how close everyone is to everyone, and who answered like who.
 */
export function computeGroupReport(qids: string[], members: Member[], meId: number): GroupReport {
  const me = members.find((m) => m.id === meId)!
  const others = members.filter((m) => m.id !== meId)
  // Questions are worded the way this player saw them during the game
  const textOf = (id: string) => questionFor(id, me.gender, othersGender(others.map((o) => o.gender)))

  // computeCompat is nearly symmetric; average both directions so A–B and B–A agree
  const pairScore = new Map<string, { score: number; same: number; together: number }>()
  const key = (a: Member, b: Member) => (a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`)
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const [a, b] = [members[i], members[j]]
      const ab = computeCompat(qids, a.answers, b.answers, { mode: 'friends' })
      const ba = computeCompat(qids, b.answers, a.answers, { mode: 'friends' })
      const byQ = new Map(b.answers.map((x) => [x.questionIndex, x.optionIndex]))
      const same = a.answers.filter((x) => x.optionIndex != null && byQ.get(x.questionIndex) === x.optionIndex).length
      pairScore.set(key(a, b), {
        score: Math.round((ab.score + ba.score) / 2),
        same,
        together: ab.answeredTogether,
      })
    }
  }

  const friends = others
    .map((o) => ({ ...person(o), ...pairScore.get(key(me, o))! }))
    .sort((x, y) => y.score - x.score)

  const pairs: GroupReport['pairs'] = []
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      pairs.push({
        a: person(members[i]),
        b: person(members[j]),
        score: pairScore.get(key(members[i], members[j]))!.score,
      })
    }
  }
  pairs.sort((x, y) => y.score - x.score)

  // Titles: the strongest "leader of a trait" goes first, and each member gets at most one
  const vectors = members.map((m) => ({ m, v: vectorFor(m.answers, qids) }))
  const leads = TRAITS.map((t) => {
    const best = [...vectors].sort((x, y) => y.v[t] - x.v[t])[0]
    return { t, m: best.m, n: best.v[t] }
  }).sort((x, y) => y.n - x.n)
  const titled = new Map<number, string>()
  for (const { t, m, n } of leads) {
    if (n <= 0 || titled.has(m.id)) continue
    titled.set(m.id, traitLabel('friends', t, m.gender === 'female'))
  }
  // Members left without a title get their own top trait, even if someone else leads it
  for (const { m, v } of vectors) {
    if (titled.has(m.id)) continue
    const top = [...TRAITS].sort((x, y) => v[y] - v[x])[0]
    if (v[top] > 0) titled.set(m.id, traitLabel('friends', top, m.gender === 'female'))
  }
  const titles = members
    .filter((m) => titled.has(m.id))
    .map((m) => ({ ...person(m), title: titled.get(m.id)! }))

  const agreed: GroupReport['agreed'] = []
  const alone: GroupReport['alone'] = []
  const splits: (GroupReport['splits'][number] & { spread: number })[] = []
  const finale: GroupReport['finale'] = []
  qids.forEach((id, i) => {
    const q = getQuestion(id)
    const view = textOf(id)
    if (!q || !view) return
    const picks = members.map((m) => ({ m, a: m.answers.find((a) => a.questionIndex === i) }))

    if (q.cat === 'saraha') {
      finale.push({
        question: view.text,
        answers: picks.map(({ m, a }) => ({ ...person(m), text: a?.text ?? null })),
      })
      return
    }

    const byOption = new Map<number, Member[]>()
    for (const { m, a } of picks) {
      if (a?.optionIndex == null) continue
      byOption.set(a.optionIndex, [...(byOption.get(a.optionIndex) ?? []), m])
    }
    const answered = [...byOption.values()].reduce((n, l) => n + l.length, 0)
    if (answered < 2) return
    // Options worded the way this player saw them
    const optionText = (o: number) => view.options[o]

    if (byOption.size === 1 && answered === members.length) {
      agreed.push({ question: view.text, answer: optionText([...byOption.keys()][0]) })
    }
    const mine = picks.find((p) => p.m.id === meId)?.a
    if (mine?.optionIndex != null && byOption.get(mine.optionIndex)!.length === 1 && answered >= 3) {
      alone.push({ question: view.text, answer: optionText(mine.optionIndex) })
    }
    if (byOption.size > 1) {
      const groups = [...byOption.entries()]
        .sort((x, y) => y[1].length - x[1].length)
        .map(([o, list]) => ({ answer: optionText(o), people: list.map(person) }))
      // The most even split is the most interesting one
      splits.push({ question: view.text, groups, spread: Math.min(...groups.map((g) => g.people.length)) * byOption.size })
    }
  })

  return {
    members: [me, ...others].map((m) => ({ ...person(m), me: m.id === meId })),
    friends,
    pairs,
    titles,
    agreed: agreed.slice(0, 3),
    alone: alone.slice(0, 3),
    splits: splits
      .sort((x, y) => y.spread - x.spread)
      .slice(0, 4)
      .map(({ question, groups }) => ({ question, groups })),
    finale,
  }
}

export type Rounds = {
  /** Each vote with how many votes everyone got, most first. Who voted for who is never shown. */
  votes: { question: string; results: (Person & { votes: number })[] }[]
  /** Each spin: who the wheel picked, the question they got and their answer */
  spins: { question: string; player: Person | null; answer: string | null; skipped: string | null }[]
}

/** The votes and spins of a friends room, the same for everyone in it. */
export function computeRounds(
  qids: string[],
  roster: { id: number; name: string; gender: string | null }[],
  all: { playerId: number; questionIndex: number; voteFor: number | null; text: string }[],
  spins: Record<string, number>,
  joker: { index: number; skipped: string } | null = null,
): Rounds {
  const votes: Rounds['votes'] = []
  const spun: Rounds['spins'] = []
  const toPerson = (p: (typeof roster)[number]): Person => person({ ...p, answers: [] })
  qids.forEach((id, i) => {
    const round = roundFor(id)
    if (round?.kind === 'vote') {
      const here = all.filter((a) => a.questionIndex === i && a.voteFor != null)
      if (!here.length) return
      votes.push({
        question: round.text,
        results: roster
          .map((p) => ({ ...toPerson(p), votes: here.filter((a) => a.voteFor === p.id).length }))
          .filter((r) => r.votes > 0)
          .sort((x, y) => y.votes - x.votes),
      })
    } else if (round?.kind === 'spin') {
      const p = roster.find((r) => r.id === spins[i])
      spun.push({
        question: personalize(round.text, p?.gender, null),
        player: p ? toPerson(p) : null,
        answer: p ? (all.find((a) => a.questionIndex === i && a.playerId === p.id)?.text ?? null) : null,
        // The question swapped away with the joker
        skipped:
          joker?.index === i
            ? personalize(roundFor(joker.skipped)?.text ?? '', p?.gender, null) || null
            : null,
      })
    }
  })
  return { votes, spins: spun }
}
