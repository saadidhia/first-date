import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Filter, TrendingUp } from 'lucide-react'

import { AdminShell, Segmented } from '@/components/admin-shell'
import { getAdminFunnel } from '@/lib/admin.functions'
import { SOURCE_LABEL } from '@/lib/traffic'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin_/funnel')({
  head: () => ({
    meta: [
      { title: 'التحويل — First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: FunnelPage,
})

type Result = Awaited<ReturnType<typeof getAdminFunnel>>

const STAGE_LABEL: Record<string, string> = {
  created: 'لعبة تعملت',
  joined: 'الطرف الآخر دخل',
  played: 'بداو يلعبو',
  finished: 'وصلو للتقرير 🎉',
}

const DAYS: { value: number; label: string }[] = [
  { value: 7, label: '7 أيام' },
  { value: 30, label: '30 يوم' },
  { value: 90, label: '90 يوم' },
]

function FunnelPage() {
  return (
    <AdminShell>
      <Funnel />
    </AdminShell>
  )
}

function Funnel() {
  const [days, setDays] = useState(30)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    const load = () =>
      getAdminFunnel({ data: { days } })
        .then((r) => {
          if (stop) return
          setResult(r)
          setError(null)
        })
        .catch(
          (e) => !stop && setError(e instanceof Error ? e.message : 'مشكل'),
        )
    load()
    const id = window.setInterval(() => !document.hidden && load(), 30_000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [days])

  const created = result?.funnel[0]?.count ?? 0
  const finished = result?.funnel.find((f) => f.key === 'finished')?.count ?? 0
  const completion = created ? Math.round((finished / created) * 100) : 0
  const maxSource = result
    ? Math.max(1, ...result.sources.map((s) => s.count))
    : 1

  return (
    <div className="mt-8">
      <h1 className="font-display text-3xl font-bold">التحويل ومنين يجيو</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        قدّاش من لاعب يكمّل اللعبة للتقرير، ومنين يجيو اللاعبين.
      </p>

      <div className="mt-5 flex items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <Segmented options={DAYS} value={days} onChange={setDays} />
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {!result ? (
        <p className="mt-6 text-sm text-muted-foreground">لحظة…</p>
      ) : (
        <div className="mt-5 space-y-6">
          {/* Headline: completion rate */}
          <div className="rounded-3xl border border-border bg-card/85 p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4" /> نسبة اللي يوصلو للتقرير
            </div>
            <div className="mt-2 font-display text-5xl font-bold tabular-nums">
              {completion}%
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {finished} من {created} لعبة وصلو للتقرير في آخر {result.days}{' '}
              يوم.
              {completion < 50 &&
                created > 0 &&
                ' أكثر من نصف اللاعبين يخرجو قبل، أنظر وين يخرجو باش تحسّن اللعبة.'}
            </p>
          </div>

          {/* Funnel bars */}
          <section className="rounded-3xl border border-border bg-card/85 p-5">
            <h2 className="font-display text-lg font-bold">المراحل</h2>
            <div className="mt-4 space-y-3">
              {result.funnel.map((stage, i) => {
                const pct = created
                  ? Math.round((stage.count / created) * 100)
                  : 0
                const prev = i > 0 ? result.funnel[i - 1].count : stage.count
                const drop =
                  prev > 0 ? Math.round(((prev - stage.count) / prev) * 100) : 0
                return (
                  <div key={stage.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">
                        {STAGE_LABEL[stage.key] ?? stage.key}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {stage.count} <span className="text-xs">({pct}%)</span>
                      </span>
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full bg-background/60">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          stage.key === 'finished'
                            ? 'bg-love'
                            : 'bg-primary/70',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {i > 0 && drop > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        ‑{drop}% خرجو في المرحلة هذي
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Traffic sources */}
          <section className="rounded-3xl border border-border bg-card/85 p-5">
            <h2 className="font-display text-lg font-bold">
              منين يجيو اللاعبين
            </h2>
            {result.sources.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                حتى لعبة في المدّة هذي.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {result.sources.map((s) => {
                  const conv = s.count
                    ? Math.round((s.finished / s.count) * 100)
                    : 0
                  return (
                    <li key={s.key}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">
                          {SOURCE_LABEL[s.key] ?? s.key}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {s.count} لعبة · {conv}% كمّلو
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-background/60">
                        <div
                          className="h-full rounded-full bg-sidi-blue"
                          style={{
                            width: `${Math.round((s.count / maxSource) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              «مباشر» معناها فتحو الرابط مباشرة ولا من رابط لعبة متشارك.
              «ماعرفناش» ألعاب قديمة قبل ما نبداو نحسبو المصدر.
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
