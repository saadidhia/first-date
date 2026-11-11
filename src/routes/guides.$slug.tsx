import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { ContentShell } from '@/components/content-shell'
import { GUIDES, getGuide, guideDate, readingMinutes } from '@/lib/guides'
import { AUTHOR, JsonLd, SITE_NAME, SITE_URL, canonical } from '@/lib/site'

export const Route = createFileRoute('/guides/$slug')({
  loader: ({ params }) => {
    const guide = getGuide(params.slug)
    if (!guide) throw notFound()
    return guide
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const title = `${loaderData.title} — First Date`
    return {
      meta: [
        { title },
        { name: 'description', content: loaderData.description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: loaderData.description },
        { property: 'og:type', content: 'article' },
        { property: 'article:published_time', content: loaderData.date },
      ],
      links: [canonical(`/guides/${loaderData.slug}`)],
    }
  },
  component: GuidePage,
})

function GuidePage() {
  const g = Route.useLoaderData()
  const more = GUIDES.filter((o) => o.slug !== g.slug).slice(0, 3)

  return (
    <ContentShell>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: g.title,
          description: g.description,
          inLanguage: 'ar-TN',
          datePublished: g.date,
          dateModified: g.date,
          author: { '@type': 'Organization', name: AUTHOR, url: `${SITE_URL}/about` },
          publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
          mainEntityOfPage: `${SITE_URL}/guides/${g.slug}`,
        }}
      />
      <article>
        <Link
          to="/guides"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          → كل المقالات
        </Link>
        <header className="mt-4">
          <span className="text-4xl" aria-hidden>
            {g.emoji}
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight md:text-4xl">
            {g.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            بقلم{' '}
            <Link to="/about" className="underline hover:text-foreground">
              {AUTHOR}
            </Link>{' '}
            · {guideDate(g.date)} · {readingMinutes(g)} دقايق قراية
          </p>
        </header>

        <p className="mt-6 text-lg leading-loose">{g.intro}</p>

        {g.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="font-display text-xl font-bold md:text-2xl">
              {s.h}
            </h2>
            {s.p?.map((p, i) => (
              <p key={i} className="mt-3 leading-loose text-foreground/90">
                {p}
              </p>
            ))}
            {s.list && (
              <ul className="mt-3 list-disc space-y-2 pe-5 leading-loose text-foreground/90">
                {s.list.map((li, i) => (
                  <li key={i}>{li}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <aside className="surface mt-10 rounded-2xl border-s-4 border-primary p-5">
          <p className="eyebrow">الخلاصة</p>
          <p className="mt-2 font-display text-lg font-semibold leading-relaxed">
            {g.takeaway}
          </p>
        </aside>

        <div className="surface mt-6 rounded-2xl p-5 text-center">
          <p className="font-display text-lg font-bold">
            جرّبو الأسئلة مع بعضكم
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            30 سؤال بالتونسي، كل واحد يجاوب من تليفونو، وفي الآخر تقرير سرّي.
          </p>
          <Link
            to="/"
            hash="start"
            className="btn-love mt-4 inline-flex h-11 items-center rounded-xl px-6 font-semibold"
          >
            ابدا لعبة
          </Link>
        </div>
      </article>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">مقالات أخرى</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {more.map((o) => (
            <Link
              key={o.slug}
              to="/guides/$slug"
              params={{ slug: o.slug }}
              className="surface rounded-2xl p-4 text-sm font-semibold leading-snug transition hover:-translate-y-0.5"
            >
              <span className="me-1.5" aria-hidden>
                {o.emoji}
              </span>
              {o.title}
            </Link>
          ))}
        </div>
      </section>
    </ContentShell>
  )
}
