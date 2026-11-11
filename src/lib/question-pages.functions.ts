import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { MARRIAGE_QUESTIONS, QUESTIONS, personalize } from './questions'
import { QUESTION_TOPICS, type QuestionTopic, getQuestionTopic } from './question-topics'

// Public sample questions for the /questions pages. Always the same handful per topic (the first
// ones of the bank, which are the mildest), so the pages are stable for search engines and don't
// give away the whole game.

const SAMPLE_SIZE = 12

type Sample = { text: string; options: string[] }

function bankFor(topic: QuestionTopic): Sample[] {
  if (topic.cat === 'marriage') {
    return MARRIAGE_QUESTIONS.map((m) => ({
      text: m.male.text,
      options: m.male.options.map((o) => o.t),
    }))
  }
  // Friends questions read best in the plural ("your friends"), date ones with the default wording
  const other = topic.mode === 'friends' ? 'group' : null
  return QUESTIONS.filter((q) => q.mode === topic.mode && q.cat === topic.cat).map((q) => ({
    text: personalize(q.text, null, other),
    options: q.options.map((o) => personalize(o.t, null, other)),
  }))
}

export const getQuestionTopicsOverview = createServerFn({ method: 'GET' }).handler(async () => {
  const counts: Record<string, number> = {}
  for (const t of QUESTION_TOPICS) counts[t.slug] = bankFor(t).length
  const total = QUESTIONS.length + MARRIAGE_QUESTIONS.length
  return { counts, total }
})

export const getQuestionTopicPage = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().max(60) }))
  .handler(async ({ data }) => {
    const topic = getQuestionTopic(data.slug)
    if (!topic) throw notFound()
    const bank = bankFor(topic)
    return { count: bank.length, samples: bank.slice(0, SAMPLE_SIZE) }
  })
