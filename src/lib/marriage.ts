import { getMarriageQuestion, type Gender } from './questions'
import type { AnswerLite } from './compat'

export type MarriageProfile = {
  name: string
  title: string
  summary: string
  answers: { topic: string; question: string; answer: string; line: string }[]
}

export type MarriageReport = {
  me: MarriageProfile
  partner: MarriageProfile
  harmony: number | null
  harmonyLine: string
  topics: { topic: string; level: 'same' | 'close' | 'far'; line: string }[]
}

type Person = { name: string; gender: string | null; answers: AnswerLite[] }

const g = (gender: string | null, male: string, female: string) =>
  (gender as Gender) === 'female' ? female : male

/** Reads one player's answers to the marriage questions. `v` runs 0 (partnership) to 2 (traditional). */
function readAnswers(qids: string[], p: Person) {
  const out: { id: string; topic: string; question: string; answer: string; line: string; v: number | null }[] = []
  for (const a of [...p.answers].sort((x, y) => x.questionIndex - y.questionIndex)) {
    const m = getMarriageQuestion(qids[a.questionIndex])
    if (!m) continue
    const variant = p.gender === 'female' ? m.female : m.male
    const opt = a.optionIndex != null ? variant.options[a.optionIndex] : undefined
    out.push({
      id: m.id,
      topic: m.topic,
      question: variant.text,
      answer: a.text,
      line: opt?.a ?? g(p.gender, 'جاوب بكلامو، وهذا يورّي إنّو عندو رأي خاص بيه.', 'جاوبت بكلامها، وهذا يورّي إنّها عندها رأي خاص بيها.'),
      v: opt ? a.optionIndex : null,
    })
  }
  return out
}

function profile(p: Person, read: ReturnType<typeof readAnswers>): MarriageProfile {
  const scored = read.filter((r) => r.v != null)
  const avg = scored.length ? scored.reduce((s, r) => s + r.v!, 0) / scored.length : null
  let title: string
  let summary: string
  if (avg == null) {
    title = g(p.gender, 'ما جاوبش 🤐', 'ما جاوبتش 🤐')
    summary = g(
      p.gender,
      'ما جاوبش بالقدر الكافي.',
      'ما جاوبتش بالقدر الكافي.',
    )
  } else if (avg < 0.7) {
    title = g(p.gender, 'شريك على قدم المساواة 🤝', 'شريكة على قدم المساواة 🤝')
    summary = g(
      p.gender,
      'الزواج عندو شراكة: القرار والفلوس والدار بالعدل.',
      'الزواج عندها شراكة: القرار والفلوس والدار بالعدل.',
    )
  } else if (avg < 1.4) {
    title = g(p.gender, 'متوازن بين الأصالة والحداثة ⚖️', 'متوازنة بين الأصالة والحداثة ⚖️')
    summary = g(
      p.gender,
      'منفتح في برشا حاجات، أما يحترم العادات في الدار والعايلة.',
      'منفتحة في برشا حاجات، أما تحترم العادات في الدار والعايلة.',
    )
  } else {
    title = g(p.gender, 'محافظ وعايلي 🏡', 'محافظة وعايلية 🏡')
    summary = g(
      p.gender,
      'كلاسيكي: الراجل على المصروف والقرار، والعايلة قبل كل شي.',
      'كلاسيكية: الراجل على المصروف والقرار، والعايلة قبل كل شي.',
    )
  }
  return {
    name: p.name,
    title,
    summary,
    answers: read.map(({ topic, question, answer, line }) => ({ topic, question, answer, line })),
  }
}

/** Builds the marriage report for `me`: both players' views and where they meet. */
export function computeMarriageReport(qids: string[], me: Person, partner: Person): MarriageReport {
  const mine = readAnswers(qids, me)
  const theirs = readAnswers(qids, partner)
  const theirsById = new Map(theirs.map((r) => [r.id, r]))

  const topics: MarriageReport['topics'] = []
  let diffSum = 0
  for (const a of mine) {
    const b = theirsById.get(a.id)
    if (!b || a.v == null || b.v == null) continue
    const diff = Math.abs(a.v - b.v)
    diffSum += diff
    topics.push(
      diff === 0
        ? { topic: a.topic, level: 'same', line: 'نفس النظرة ✅' }
        : diff === 1
          ? { topic: a.topic, level: 'close', line: 'قريبين 🙂' }
          : { topic: a.topic, level: 'far', line: 'بعاد، احكيو عليها ⚠️' },
    )
  }

  const harmony = topics.length ? Math.round(100 - (diffSum / topics.length / 2) * 100) : null
  const harmonyLine =
    harmony == null
      ? 'ما فمّاش أجوبة كافية باش نقارنو.'
      : harmony >= 80
        ? 'نفس الأساس، تنجمو تبنيو دار مع بعضكم 💍'
        : harmony >= 55
          ? 'تتلاقاو في الأساس، أما فمّا نقاط لازم تتحكى.'
          : 'نظرتكم مختلفة برشا. احكيو بالصراحة قبل أي خطوة.'

  return {
    me: profile(me, mine),
    partner: profile(partner, theirs),
    harmony,
    harmonyLine,
    topics,
  }
}
