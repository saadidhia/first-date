import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays, Clock, Gamepad2, Moon, Radio, Users } from 'lucide-react'

import { AdminShell, StatCard } from '@/components/admin-shell'
import { getAdminStats } from '@/lib/admin.functions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin_/stats')({
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
      {stats && <DailyTable days={stats.days} />}
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

function DailyTable({ days }: { days: Stats['days'] }) {
  const fmt = (n: number) => n.toLocaleString('ar-TN')
  const duration = (min: number | null) => {
    if (min == null) return '—'
    const h = Math.floor(min / 60)
    return h > 0 ? `${h}س ${min % 60}د` : `${min}د`
  }
  return (
    <section className="mt-8 rounded-3xl border border-border bg-card/85 p-5">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-5 text-gold" />
        <h2 className="font-display text-lg font-semibold">كل نهار</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">آخر 30 يوم، بتوقيت تونس. اللي يلعب زوز لعبات يتحسب زوز مرّات.</p>
      {days.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">حتى حد ما لعب في آخر 30 يوم.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
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
                    {new Date(`${d.day}T12:00:00Z`).toLocaleDateString('ar-TN', { weekday: 'short', day: 'numeric', month: 'short' })}
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
    </section>
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
