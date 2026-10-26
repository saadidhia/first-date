import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays, Clock, Gamepad2, Moon, Radio, Users } from 'lucide-react'

import { AdminShell, StatCard } from '@/components/admin-shell'
import { getAdminStats } from '@/lib/admin.functions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'الإحصائيات — First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: StatsPage,
})

type Stats = Awaited<ReturnType<typeof getAdminStats>>

function StatsPage() {
  return (
    <AdminShell>
      <Dashboard />
    </AdminShell>
  )
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    const load = () =>
      getAdminStats()
        .then((s) => {
          if (stop) return
          setStats(s)
          setError(null)
        })
        .catch((e) => !stop && setError(e instanceof Error ? e.message : 'مشكل'))
    load()
    // Skip refreshes while the tab is hidden; reload as soon as it is visible again
    const id = window.setInterval(() => !document.hidden && load(), 10_000)
    const onVisible = () => !document.hidden && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stop = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString('ar-TN'))

  return (
    <div className="mt-8">
      <h1 className="font-display text-3xl font-bold">الإحصائيات</h1>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<Users className="size-5" />}
          label="عدد الأشخاص اللي دخلو"
          hint="كل واحد دخل للّعبة من النهار الأوّل"
          value={fmt(stats?.total)}
        />
        <StatCard
          icon={<Radio className="size-5 text-emerald-400" />}
          label="يستعملو الموقع توّا"
          hint="يلعبو في آخر 20 ثانية"
          value={fmt(stats?.active)}
          live
        />
        <StatCard
          icon={<Clock className="size-5 text-gold" />}
          label="كانو en ligne في آخر ساعة"
          hint="لعبو في آخر 60 دقيقة"
          value={fmt(stats?.lastHour)}
        />
        <EmptyTodayCard today={stats?.today} />
      </div>
      {stats && <GamesByMode games={stats.games} />}
      {stats && <DailySection days={stats.days} />}
      {stats && <RecentList people={stats.recent} />}
      <p className="mt-4 text-xs text-muted-foreground">
        تتحدّث وحدها كل 10 ثواني
        {stats && ` · آخر تحديث ${new Date(stats.at).toLocaleTimeString('ar-TN')}`}
      </p>
    </div>
  )
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' })

/** Whether there was a minute today with nobody playing. */
function EmptyTodayCard({ today }: { today: Stats['today'] | undefined }) {
  let value = '—'
  let hint = 'نحسبو من نصّ الليل (بتوقيت تونس)'
  if (today && !today.since) {
    hint = 'مازال ما عندناش معلومات على اليوم'
  } else if (today?.since) {
    const from = `من ${clock(today.since)}`
    if (today.emptyMinutes === 0) {
      value = 'لا'
      hint = `ديما كان فما شكون يلعب ${from}`
    } else {
      value = 'إيه'
      const h = Math.floor(today.emptyMinutes / 60)
      const m = today.emptyMinutes % 60
      const length = h > 0 ? `${h} ساعة و${m} دقيقة` : `${m} دقيقة`
      hint = `فرغ ${length} ${from}، آخر مرّة ${clock(today.lastEmptyAt!)}`
    }
  }
  return <StatCard icon={<Moon className="size-5 text-sidi-blue" />} label="الموقع فرغ اليوم؟" hint={hint} value={value} />
}

type Range = 7 | 30 | 90
type ModeFilter = 'all' | 'date' | 'friends'
type Metric = 'players' | 'rooms'

const RANGES: { value: Range; label: string }[] = [
  { value: 7, label: '7 أيّام' },
  { value: 30, label: '30 يوم' },
  { value: 90, label: '3 شهور' },
]
const MODES: { value: ModeFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'date', label: '💘 First Date' },
  { value: 'friends', label: '🤝 صحاب' },
]
const METRICS: { value: Metric; label: string }[] = [
  { value: 'players', label: 'لاعبين' },
  { value: 'rooms', label: 'لعبات' },
]

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('ar-TN', { weekday: 'short', day: 'numeric', month: 'short' })

/** The last `range` days (Tunisia time), oldest first, as YYYY-MM-DD. */
function lastDays(range: number) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
  const noon = new Date(`${today}T12:00:00Z`).getTime()
  return Array.from({ length: range }, (_, i) =>
    new Date(noon - (range - 1 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  )
}

/** Daily chart with its filters (period, game type, players or games), and the table under it. */
function DailySection({ days }: { days: Stats['days'] }) {
  const [range, setRange] = useState<Range>(30)
  const [mode, setMode] = useState<ModeFilter>('all')
  const [metric, setMetric] = useState<Metric>('players')

  const inRange = useMemo(() => {
    const from = lastDays(range)[0]
    return days.filter((d) => d.day >= from)
  }, [days, range])

  return (
    <section className="mt-8 rounded-3xl border border-border bg-card/85 p-5">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-5 text-gold" />
        <h2 className="font-display text-lg font-semibold">كل نهار</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        بتوقيت تونس. اللي يلعب زوز لعبات يتحسب زوز مرّات.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Segmented options={RANGES} value={range} onChange={setRange} />
        <Segmented options={MODES} value={mode} onChange={setMode} />
        <Segmented options={METRICS} value={metric} onChange={setMetric} />
      </div>
      <DailyChart days={days} range={range} mode={mode} metric={metric} />
      <DailyTable days={inRange} range={range} />
    </section>
  )
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-xl border border-border bg-background/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg px-2.5 py-1 text-xs transition',
            value === o.value ? 'bg-primary/20 font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Bars per day: stacked First Date (red) + صحاب (blue), or just the chosen type. */
function DailyChart({
  days,
  range,
  mode,
  metric,
}: {
  days: Stats['days']
  range: Range
  mode: ModeFilter
  metric: Metric
}) {
  const [hover, setHover] = useState<number | null>(null)
  const fmt = (n: number) => n.toLocaleString('ar-TN')
  const unit = metric === 'players' ? 'لاعب' : 'لعبة'

  const bars = useMemo(() => {
    const byDay = new Map(days.map((d) => [d.day, d]))
    return lastDays(range).map((day) => {
      const d = byDay.get(day)
      const date = d ? (metric === 'players' ? d.datePlayers : d.dateRooms) : 0
      const friends = d ? (metric === 'players' ? d.friendsPlayers : d.friendsRooms) : 0
      return { day, date: mode === 'friends' ? 0 : date, friends: mode === 'date' ? 0 : friends }
    })
  }, [days, range, mode, metric])

  const totals = bars.map((b) => b.date + b.friends)
  const max = Math.max(1, ...totals)
  const sum = totals.reduce((a, b) => a + b, 0)
  const shown = hover == null ? null : bars[hover]

  return (
    <div className="mt-5">
      <div className="flex min-h-10 flex-wrap items-end justify-between gap-2">
        {shown ? (
          <p className="text-sm">
            <span className="text-muted-foreground">{dayLabel(shown.day)} · </span>
            <span className="font-semibold tabular-nums">
              {fmt(shown.date + shown.friends)} {unit}
            </span>
            {mode === 'all' && (
              <span className="text-xs text-muted-foreground">
                {' '}
                ({fmt(shown.date)} First Date · {fmt(shown.friends)} صحاب)
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm">
            <span className="font-display text-2xl font-bold tabular-nums">{fmt(sum)}</span>{' '}
            <span className="text-muted-foreground">
              {unit} · معدّل {fmt(Math.round((sum / range) * 10) / 10)} في النهار
            </span>
          </p>
        )}
        {mode === 'all' && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary" /> First Date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-sidi-blue" /> صحاب
            </span>
          </div>
        )}
      </div>

      <div className="relative mt-3">
        <span className="absolute -top-2 end-0 text-[10px] text-muted-foreground tabular-nums">{fmt(max)}</span>
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <div
          className="flex h-44 items-end border-b border-border"
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={`${fmt(sum)} ${unit} في آخر ${range} يوم`}
        >
          {bars.map((b, i) => {
            const total = b.date + b.friends
            return (
              <button
                key={b.day}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                aria-label={`${dayLabel(b.day)}: ${fmt(total)} ${unit}`}
                className={cn(
                  'flex h-full min-w-0 flex-1 flex-col justify-end px-px',
                  range <= 30 && 'px-0.5',
                  hover != null && hover !== i && 'opacity-50',
                )}
              >
                {b.friends > 0 && (
                  <span
                    className={cn('w-full rounded-t-[4px] bg-sidi-blue', b.date > 0 && 'mb-[2px]')}
                    style={{ height: `${(b.friends / max) * 100}%` }}
                  />
                )}
                {b.date > 0 && (
                  <span
                    className={cn('w-full bg-primary', b.friends === 0 && 'rounded-t-[4px]')}
                    style={{ height: `${(b.date / max) * 100}%` }}
                  />
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{dayLabel(bars[0].day)}</span>
          <span>اليوم</span>
        </div>
      </div>
    </div>
  )
}

function DailyTable({ days, range }: { days: Stats['days']; range: number }) {
  const fmt = (n: number) => n.toLocaleString('ar-TN')
  const duration = (min: number | null) => {
    if (min == null) return '—'
    const h = Math.floor(min / 60)
    return h > 0 ? `${h}س ${min % 60}د` : `${min}د`
  }
  return (
    <div className="mt-6">
      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">حتى حد ما لعب في آخر {range} يوم.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-start">
                <th className="py-2 text-start font-normal">النهار</th>
                <th className="py-2 text-start font-normal">لاعبين</th>
                <th className="py-2 text-start font-normal">لعبات</th>
                <th className="py-2 text-start font-normal">💘 First Date</th>
                <th className="py-2 text-start font-normal">🤝 صحاب</th>
                <th className="py-2 text-start font-normal">وقت فيه ناس</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {days.map((d) => (
                <tr key={d.day}>
                  <td className="py-2">
                    {dayLabel(d.day)}
                  </td>
                  <td className="py-2 font-semibold">{fmt(d.players)}</td>
                  <td className="py-2">{fmt(d.rooms)}</td>
                  <td className="py-2 text-primary">{fmt(d.dateRooms)}</td>
                  <td className="py-2 text-sidi-blue">{fmt(d.friendsRooms)}</td>
                  <td className="py-2 text-muted-foreground">{duration(d.activeMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** How many games were played as First Date (couples) and as صحاب (friends). */
function GamesByMode({ games }: { games: Stats['games'] }) {
  const fmt = (n: number) => n.toLocaleString('ar-TN')
  const all = games.date.total + games.friends.total
  const share = (n: number) => (all === 0 ? 0 : Math.round((n / all) * 100))
  const modes = [
    { key: 'date', label: '💘 First Date (كوبل)', bar: 'bg-primary', ...games.date },
    { key: 'friends', label: '🤝 صحاب', bar: 'bg-sidi-blue', ...games.friends },
  ]
  return (
    <section className="mt-8 rounded-3xl border border-border bg-card/85 p-5">
      <div className="flex items-center gap-2">
        <Gamepad2 className="size-5 text-gold" />
        <h2 className="font-display text-lg font-semibold">اللعبات حسب النوع</h2>
        <span className="ms-auto text-sm text-muted-foreground tabular-nums">المجموع {fmt(all)}</span>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
        {modes.map((m) => (
          <div key={m.key} className={m.bar} style={{ width: `${share(m.total)}%` }} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {modes.map((m) => (
          <div key={m.key} className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={cn('size-2.5 rounded-full', m.bar)} />
              {m.label}
              <span className="ms-auto tabular-nums">{share(m.total)}%</span>
            </div>
            <div className="mt-2 font-display text-4xl font-bold tabular-nums">{fmt(m.total)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {fmt(m.done)} كمّلو للآخر · {fmt(m.today)} اليوم
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

const PHASE_LABEL: Record<string, string> = {
  waiting: 'يستنّى الطرف الآخر',
  intro: 'بداية',
  question: 'يجاوب',
  reveal: 'يجاوب',
  done: 'كمّل',
}

function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `قبل ${s} ثانية`
  return `قبل ${Math.round(s / 60)} دقيقة`
}

function RecentList({ people }: { people: Stats['recent'] }) {
  return (
    <section className="mt-8 rounded-3xl border border-border bg-card/85 p-5">
      <h2 className="font-display text-lg font-semibold">شكون كان en ligne في آخر ساعة</h2>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">حتى حد ما دخل في آخر ساعة.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  p.online ? 'bg-emerald-400' : 'bg-muted-foreground/40',
                )}
                title={p.online ? 'en ligne توّا' : 'خرج'}
              />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {p.gender === 'female' ? '👰' : p.gender === 'male' ? '🤵' : '👤'} {p.name}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                لعبة <span dir="ltr" className="font-mono">{p.code}</span> · {PHASE_LABEL[p.phase] ?? p.phase}
              </span>
              <span className={cn('text-xs tabular-nums', p.online ? 'text-emerald-400' : 'text-muted-foreground')}>
                {p.online ? 'en ligne توّا' : timeAgo(p.lastSeenAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
