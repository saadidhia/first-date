import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { ContentShell } from '@/components/content-shell'
import { canonical } from '@/lib/site'
import { getQuestionTopicPage } from '@/lib/question-pages.functions'
import { QUESTION_TOPICS, getQuestionTopic } from '@/lib/question-topics'

export const Route = createFileRoute('/questions/$topic')({
  loader: async ({ params }) => {
    const topic = getQuestionTopic(params.topic)
    if (!topic) throw notFound()
    const page = await getQuestionTopicPage({ data: { slug: topic.slug } })
    return { topic, ...page }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const title = `${loaderData.topic.title} — First Date`
    return {
      meta: [
        { title },
        { name: 'description', content: loaderData.topic.intro },
        { property: 'og:title', content: title },
        { property: 'og:description', content: loaderData.topic.intro },
      ],
      links: [canonical(`/questions/${loaderData.topic.slug}`)],
    }
  },
  component: TopicPage,
})

function TopicPage() {
  const { topic, count, samples } = Route.useLoaderData()
  const others = QUESTION_TOPICS.filter(
    (t) => t.mode === topic.mode && t.slug !== topic.slug,
  )

  return (
    <ContentShell>
      <Link
        to="/questions"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        → كل المواضيع
      </Link>
      <header className="mt-4">
        <span className="text-4xl" aria-hidden>
          {topic.emoji}
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight md:text-4xl">
          {topic.title}
        </h1>
        <p className="mt-4 text-lg leading-loose text-foreground/90">
          {topic.intro}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {samples.length} أمثلة من {count} سؤال في الموضوع هذا. في اللعبة
          الأسئلة تتبدّل كل مرّة.
        </p>
      </header>

      <ol className="mt-8 space-y-4">
        {samples.map((q, i) => (
          <li key={i} className="surface rounded-2xl p-5">
            <p className="font-semibold leading-relaxed">
              <span className="me-2 text-gold">{i + 1}.</span>
              {q.text}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {q.options.map((o, j) => (
                <li key={j} className="rounded-xl bg-background/40 px-3 py-2">
                  {o}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <section className="surface mt-8 rounded-2xl p-5">
        <h2 className="font-display text-lg font-bold">
          كيفاش تستعمل الأسئلة هاذي؟
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pe-5 leading-relaxed text-muted-foreground">
          <li>
            جاوبو الزوز في نفس الوقت، كل واحد بروحو، وبعد قارنو. هكّا ما حد
            يتأثّر بجواب الآخر.
          </li>
          <li>
            ما ثمّاش جواب صحيح وجواب غالط. المهمّ تسألو بعضكم «علاش اخترت هذا؟».
          </li>
          <li>
            كان لقيتو اختلاف كبير، خوذوه بداية حديث موش سبب خصام.
          </li>
        </ul>
        <Link
          to="/"
          hash="start"
          className="btn-love mt-4 inline-flex h-11 items-center rounded-xl px-6 font-semibold"
        >
          العبوها مع بعضكم
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">مواضيع أخرى</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {others.map((t) => (
            <Link
              key={t.slug}
              to="/questions/$topic"
              params={{ topic: t.slug }}
              className="rounded-full border border-border bg-card/70 px-4 py-2 text-sm transition hover:border-primary/40"
            >
              {t.emoji} {t.title}
            </Link>
          ))}
        </div>
      </section>
    </ContentShell>
  )
}
