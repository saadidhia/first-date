import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { canonical } from '@/lib/site'
import { ContentShell } from '@/components/content-shell'
import { GUIDES, guideDate, readingMinutes } from '@/lib/guides'

const title = 'مقالات ونصائح على العلاقات والصحبة — First Date'
const description =
  'مقالات بالتونسي على المواضيع اللي تهمّ الكوبلات والصحاب: الفلوس، العايلة، الغيرة، أوّل موعد، والأسئلة اللي لازم تتحكى قبل الخطوبة.'

export const Route = createFileRoute('/guides/')({
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
    ],
    links: [canonical('/guides')],
  }),
  component: GuidesPage,
})

function GuidesPage() {
  return (
    <ContentShell>
      <p className="eyebrow">مقالات ونصائح</p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">
        باش تعرفو بعضكم خير
      </h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
        اللعبة تفتح الحديث، والمقالات هاذي تكمّلو. نحكيو فيها بالتونسي على
        المواضيع اللي تجي في الأسئلة: الفلوس، العايلة، الغيرة، والصحبة، مع نصائح
        عملية تنجّم تستعملها من اليوم.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            to="/guides/$slug"
            params={{ slug: g.slug }}
            className="surface group flex flex-col rounded-2xl p-5 transition hover:-translate-y-0.5"
          >
            <span className="text-3xl" aria-hidden>
              {g.emoji}
            </span>
            <h2 className="mt-3 font-display text-lg font-bold leading-snug">
              {g.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {g.description}
            </p>
            <span className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {guideDate(g.date)} · {readingMinutes(g)} دقايق قراية
              </span>
              <ArrowLeft className="size-4 text-primary transition group-hover:-translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </ContentShell>
  )
}
