import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { canonical } from '@/lib/site'
import { ContentShell } from '@/components/content-shell'
import { getQuestionTopicsOverview } from '@/lib/question-pages.functions'
import { QUESTION_TOPICS, type QuestionTopic } from '@/lib/question-topics'

const title = 'أسئلة للكوبلات والصحاب بالتونسي — First Date'
const description =
  'أمثلة من أسئلة First Date مرتّبة على المواضيع: الفلوس، العايلة، الغيرة، الخيانة، الزواج، وأسئلة محرجة للصحاب. بالدارجة التونسية.'

export const Route = createFileRoute('/questions/')({
  loader: () => getQuestionTopicsOverview(),
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
    ],
    links: [canonical('/questions')],
  }),
  component: QuestionsPage,
})

function QuestionsPage() {
  const { counts, total } = Route.useLoaderData()
  const date = QUESTION_TOPICS.filter((t) => t.mode === 'date')
  const friends = QUESTION_TOPICS.filter((t) => t.mode === 'friends')

  return (
    <ContentShell>
      <p className="eyebrow">بنك الأسئلة</p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">
        أسئلة للكوبلات والصحاب بالتونسي
      </h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
        في First Date أكثر من {total} سؤال كتبناهم بالدارجة، على مواقف نعيشوها
        كل يوم في تونس. هوني تلقى أمثلة من كل موضوع مع الأجوبة الثلاثة، تنجّم
        تستعملها في سهرية، في أوّل موعد، ولا باش تحضّر روحك للعبة.
      </p>

      <TopicGrid heading="للكوبلات 💑" topics={date} counts={counts} />
      <TopicGrid heading="للصحاب 🎲" topics={friends} counts={counts} />
    </ContentShell>
  )
}

function TopicGrid({
  heading,
  topics,
  counts,
}: {
  heading: string
  topics: QuestionTopic[]
  counts: Record<string, number>
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold">{heading}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {topics.map((t) => (
          <Link
            key={t.slug}
            to="/questions/$topic"
            params={{ topic: t.slug }}
            className="surface group flex items-start gap-3 rounded-2xl p-4 transition hover:-translate-y-0.5"
          >
            <span className="text-2xl" aria-hidden>
              {t.emoji}
            </span>
            <span className="flex-1">
              <span className="block font-semibold leading-snug">{t.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {counts[t.slug] ?? 0} سؤال
              </span>
            </span>
            <ArrowLeft className="mt-1 size-4 text-primary transition group-hover:-translate-x-1" />
          </Link>
        ))}
      </div>
    </section>
  )
}
