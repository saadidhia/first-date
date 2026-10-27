import {
  CATEGORY_LABEL,
  type Category,
  type Mode,
  type Trait,
  getQuestion,
  questionFor,
} from './questions'

export type AnswerLite = { questionIndex: number; optionIndex: number | null; text: string }

export type CompatResult = {
  score: number
  verdict: string
  verdictEmoji: string
  tone: 'great' | 'good' | 'maybe' | 'hard'
  /** One line that sums up the other player */
  headline: string
  traits: { key: Trait; label: string; line: string; pct: number }[]
  tips: string[]
  topics: { cat: Category; label: string; together: number; same: number; partnerTrait: string | null }[]
  matches: { question: string; answer: string }[]
  differences: { question: string; mine: string; theirs: string }[]
  /** Both answers to the finale questions (friends rooms; marriage has its own report) */
  finale: { question: string; mine: string | null; theirs: string | null }[]
  warnings: string[]
  answeredTogether: number
}

export const TRAITS: Trait[] = [
  'romance',
  'adventure',
  'jealousy',
  'independence',
  'humor',
  'tradition',
  'calm',
]

// Phrased around "شخصية" so the note reads naturally for any gender
const TRAIT_TEXT: Record<Mode, Record<Trait, { label: string; line: string; tip: string }>> = {
  date: {
    romance: {
      label: 'رومانسي 🌹',
      line: 'تحب الكلام الحلو والتفاصيل الصغيرة.',
      tip: 'كلمة حلوة في وقتها تربح بيها برشا.',
    },
    adventure: {
      label: 'مغامر 🔥',
      line: 'تكره الروتين وديما تلوّج على الجديد.',
      tip: 'بدّل الجو، خرجة جديدة خير من ألف مساج.',
    },
    jealousy: {
      label: 'غيور 👀',
      line: 'تحتاج أمان واهتمام، والغيرة باينة.',
      tip: 'الوضوح يطمّن: ما تخلّيش بلاصة للشك.',
    },
    independence: {
      label: 'مستقل 🦅',
      line: 'تحب حرّيتها ومساحتها، ما تحبّش الضغط.',
      tip: 'عطيه مساحتو، الضغط يبعّد.',
    },
    humor: {
      label: 'ضحوك 😂',
      line: 'خفيفة، تحوّل أي موقف لضحكة.',
      tip: 'اضحك معاه، الجدّية الزايدة تقلّقو.',
    },
    tradition: {
      label: 'محافظ 🏡',
      line: 'مربوطة بالعادات والعايلة والأصول.',
      tip: 'احترم عايلتو وعاداتو، هاذي نقطة حسّاسة.',
    },
    calm: {
      label: 'هادي 🧘',
      line: 'رزينة، تخمّم قبل ما تحكي.',
      tip: 'احكي معاه بالعقل، الصياح ما يجيبش.',
    },
  },
  friends: {
    romance: {
      label: 'قلبو طيّب 🤍',
      line: 'وفيّة وتعطي من قلبها لصحابها.',
      tip: 'قدّر وقفتو معاك، يستاهل.',
    },
    adventure: {
      label: 'مهبول 🤪',
      line: 'ديما حاضرة للتخلويض والتجارب.',
      tip: 'خرجة مجنونة توّا توّا تفرّحو.',
    },
    jealousy: {
      label: 'يغير على صحابو 👀',
      line: 'تحب تكون الأولى عند صحابها.',
      tip: 'ما تنساهوش كي تعرف ناس جدد.',
    },
    independence: {
      label: 'مستقل 🦅',
      line: 'تحب مساحتها، ما تحبّش الالتصاق.',
      tip: 'ما تتقلقش كان يغيب، يرجع وحدو.',
    },
    humor: {
      label: 'فدلاك 😂',
      line: 'روح الجماعة، الضحك معاها مضمون.',
      tip: 'الفدلكة هي لغتكم، أما ما تزيدش فيها.',
    },
    tradition: {
      label: 'عندو مبادئ 🧭',
      line: 'كلمتها كلمة وعندها خطوط حمراء.',
      tip: 'ما تلعبش بثقتو، يحفظها.',
    },
    calm: {
      label: 'عاقل 🧘',
      line: 'رزينة، تعطي النصيحة في وقتها.',
      tip: 'كي تتلخبط، شاورو.',
    },
  },
}

// Masculine labels/tips above; the lines are about a "شخصية". Feminine labels for the portrait:
const FEMININE_LABEL: Record<Mode, Partial<Record<Trait, string>>> = {
  date: {
    romance: 'رومانسية 🌹',
    adventure: 'مغامرة 🔥',
    jealousy: 'غيورة 👀',
    independence: 'مستقلة 🦅',
    humor: 'ضحوكة 😂',
    tradition: 'محافظة 🏡',
    calm: 'هادية 🧘',
  },
  friends: {
    romance: 'قلبها طيّب 🤍',
    adventure: 'مهبولة 🤪',
    jealousy: 'تغير على صحابها 👀',
    independence: 'مستقلة 🦅',
    humor: 'فدلاكة 😂',
    tradition: 'عندها مبادئ 🧭',
    calm: 'عاقلة 🧘',
  },
}

/** A trait's short label (with emoji), worded for the person it describes. */
export const traitLabel = (mode: Mode, t: Trait, female: boolean) =>
  female ? FEMININE_LABEL[mode][t]! : TRAIT_TEXT[mode][t].label

const feminineTip = (tip: string) =>
  tip
    .replace('عطيه مساحتو', 'عطيها مساحتها')
    .replaceAll('معاه', 'معاها')
    .replace('تقلّقو', 'تقلّقها')
    .replace('عايلتو وعاداتو', 'عايلتها وعاداتها')
    .replace('وقفتو', 'وقفتها')
    .replace('تفرّحو', 'تفرّحها')
    .replace('ما تنساهوش', 'ما تنساهاش')
    .replace('يغيب، يرجع وحدو', 'تغيب، ترجع وحدها')
    .replace('بثقتو، يحفظها', 'بثقتها، تحفظها')
    .replace('شاورو', 'شاورها')
    .replace('يستاهل', 'تستاهل')

export function vectorFor(list: AnswerLite[], qids: string[], only?: Category) {
  const v: Record<Trait, number> = Object.fromEntries(TRAITS.map((t) => [t, 0])) as Record<
    Trait,
    number
  >
  for (const a of list) {
    if (a.optionIndex == null) continue
    const q = getQuestion(qids[a.questionIndex])
    if (!q || (only && q.cat !== only)) continue
    const opt = q.options[a.optionIndex]
    if (!opt) continue
    for (const [k, n] of Object.entries(opt.s)) v[k as Trait] += n ?? 0
  }
  return v
}

const topTrait = (v: Record<Trait, number>) => {
  const best = [...TRAITS].sort((x, y) => v[y] - v[x])[0]
  return v[best] > 0 ? best : null
}

function cosine(a: Partial<Record<Trait, number>>, b: Partial<Record<Trait, number>>) {
  let dot = 0
  let na = 0
  let nb = 0
  for (const t of TRAITS) {
    const x = a[t] ?? 0
    const y = b[t] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

const VERDICTS: Record<Mode, Record<CompatResult['tone'], [string, string]>> = {
  date: {
    great: ['💚', 'كيمياء واضحة! تفكيركم قريب برشا.'],
    good: ['💛', 'أساس باهي، والباقي يتبنى بالحوار.'],
    maybe: ['🧡', 'ممكن… أما يلزم صبر وصراحة.'],
    hard: ['💔', 'بعاد على بعضكم، ما تجريش.'],
  },
  friends: {
    great: ['💚', 'صحبة من ذهب! نفس الموجة.'],
    good: ['💛', 'صحبة باهية، تتفاهمو في الأغلب.'],
    maybe: ['🧡', 'مختلفين ياسر، أما الاختلاف يكمّل.'],
    hard: ['💔', 'كل واحد في عالم… الصحبة تحب خدمة.'],
  },
}

/** Builds the private note `mine`'s owner sees about their partner. */
export function computeCompat(
  qids: string[],
  mine: AnswerLite[],
  theirs: AnswerLite[],
  ctx: { mode: Mode; myGender?: string | null; partnerGender?: string | null } = { mode: 'date' },
): CompatResult {
  const { mode } = ctx
  const female = ctx.partnerGender === 'female'
  const textOf = (id: string) => questionFor(id, ctx.myGender, ctx.partnerGender)
  const theirsByQ = new Map(theirs.map((a) => [a.questionIndex, a]))
  const mineByQ = new Map(mine.map((a) => [a.questionIndex, a]))
  let total = 0
  let together = 0
  const matches: CompatResult['matches'] = []
  const differences: CompatResult['differences'] = []
  const topicCount = new Map<Category, { together: number; same: number }>()

  for (const a of mine) {
    const b = theirsByQ.get(a.questionIndex)
    const id = qids[a.questionIndex]
    const q = getQuestion(id)
    if (!b || !q) continue
    together++
    const tc = topicCount.get(q.cat) ?? { together: 0, same: 0 }
    tc.together++
    topicCount.set(q.cat, tc)
    const view = textOf(id)!
    if (a.optionIndex != null && a.optionIndex === b.optionIndex) {
      total += 1
      tc.same++
      matches.push({ question: view.text, answer: a.text })
    } else if (q.options[a.optionIndex ?? -1] && q.options[b.optionIndex ?? -1]) {
      const sim = cosine(q.options[a.optionIndex!].s, q.options[b.optionIndex!].s)
      total += 0.75 * sim
      if (sim < 0.5) differences.push({ question: view.text, mine: a.text, theirs: b.text })
    } else {
      // Free-text answers: neutral contribution
      total += 0.5
    }
  }

  const raw = together ? total / together : 0.5
  let score = Math.round(30 + raw * 68)

  const me = vectorFor(mine, qids)
  const them = vectorFor(theirs, qids)
  const warnings: string[] = []
  if (them.jealousy >= 6 && me.independence >= 6) {
    score -= 6
    warnings.push(
      mode === 'date'
        ? 'يغير برشا وإنتي تحب حرّيتك… احكيو عليها بكري.'
        : 'يحب يكون الأوّل عندك، وإنتي تحب مساحتك.',
    )
  }
  if (me.jealousy >= 6 && them.independence >= 6) {
    score -= 4
    warnings.push(
      mode === 'date'
        ? 'يحب مساحتو وإنتي تحتاج اهتمام… التوازن مهم.'
        : 'يحب مساحتو، ما تاخوش غيابو على خاطرك.',
    )
  }
  if (Math.abs(me.tradition - them.tradition) >= 8) {
    score -= 4
    warnings.push('نظرتكم للعادات والمبادئ بعيدة شويّة.')
  }
  if (me.humor >= 6 && them.humor >= 6) score += 3
  score = Math.max(18, Math.min(98, score))
  if (female) {
    for (let i = 0; i < warnings.length; i++) {
      warnings[i] = warnings[i]
        .replace('يغير', 'تغير')
        .replace('يحب مساحتو', 'تحب مساحتها')
        .replace('يحب يكون الأوّل', 'تحب تكون الأولى')
        .replace('غيابو', 'غيابها')
    }
  }

  const texts = TRAIT_TEXT[mode]
  const labelOf = (t: Trait) => traitLabel(mode, t, female)
  const themTotal = TRAITS.reduce((s, t) => s + them[t], 0) || 1
  const top = [...TRAITS]
    .sort((x, y) => them[y] - them[x])
    .filter((t) => them[t] > 0)
    .slice(0, 3)
  const traits = top.map((t) => ({
    key: t,
    label: labelOf(t),
    line: `شخصية ${texts[t].line}`,
    pct: Math.round((them[t] / themTotal) * 100),
  }))
  const tips = top.slice(0, 2).map((t) => (female ? feminineTip(texts[t].tip) : texts[t].tip))
  const headline = top.length
    ? top
        .slice(0, 2)
        .map((t) => labelOf(t))
        .join(' و')
    : female
      ? 'ما حكاتش برشا 🤐'
      : 'ما حكاش برشا 🤐'

  const topics: CompatResult['topics'] = [...topicCount.entries()]
    .filter(([cat]) => cat !== 'saraha')
    .map(([cat, c]) => {
      const t = topTrait(vectorFor(theirs, qids, cat))
      return { cat, label: CATEGORY_LABEL[cat], ...c, partnerTrait: t ? labelOf(t) : null }
    })
    .sort((x, y) => y.together - x.together)

  const finale: CompatResult['finale'] = []
  qids.forEach((id, i) => {
    if (getQuestion(id)?.cat !== 'saraha') return
    finale.push({
      question: textOf(id)!.text,
      mine: mineByQ.get(i)?.text ?? null,
      theirs: theirsByQ.get(i)?.text ?? null,
    })
  })

  const tone: CompatResult['tone'] =
    score >= 80 ? 'great' : score >= 65 ? 'good' : score >= 50 ? 'maybe' : 'hard'
  const [verdictEmoji, verdict] = VERDICTS[mode][tone]

  return {
    score,
    verdict,
    verdictEmoji,
    tone,
    headline,
    traits,
    tips,
    topics,
    matches: matches.slice(0, 3),
    differences: differences.slice(0, 3),
    finale,
    warnings,
    answeredTogether: together,
  }
}
