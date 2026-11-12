import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { matchWord, timeAgo } from '@/components/admin-games'
import { AdminShell, Segmented } from '@/components/admin-shell'
import { getAdminGames } from '@/lib/admin.functions'
import { SOURCE_LABEL } from '@/lib/traffic'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin_/games')({
  head: () => ({
    meta: [
      { title: 'آخر الألعاب · First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: GamesPage,
})

type Game = Awaited<ReturnType<typeof getAdminGames>>['games'][number]
type Kind = Game['kind']
type KindFilter = 'all' | Kind

const LIMIT = 100
// A game nobody has had open for this long, and that never finished, was left halfway
const ABANDONED_MS = 10 * 60 * 1000

const KIND: Record<Kind, { icon: string; label: string }> = {
  date: { icon: '💘', label: 'First Date' },
  friends: { icon: '🤝', label: 'صحاب' },
  board: { icon: '🎲', label: 'ثنية العرس' },
  board_friends: { icon: '👑', label: 'ملك القعدة' },
}

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'date', label: '💘 First Date' },
  { value: 'friends', label: '🤝 صحاب' },
  { value: 'board', label: '🎲 ثنية العرس' },
  { value: 'board_friends', label: '👑 ملك القعدة' },
]

type Status = 'done' | 'live' | 'playing' | 'abandoned' | 'waiting'
const STATUS: Record<Status, { label: string; className: string }> = {
  done: { label: '✅ كمّلو', className: 'bg-emerald-500/15 text-emerald-300' },
  live: { label: '🟢 يلعبو توّا', className: 'bg-emerald-500/15 text-emerald-300' },
  playing: { label: '🟡 في النص', className: 'bg-amber-500/15 text-amber-300' },
  abandoned: { label: '💤 متروكة', className: 'bg-muted text-muted-foreground' },
  waiting: { label: '⏳ يستنّاو', className: 'bg-sidi-blue/15 text-sidi-blue' },
}

function statusOf(g: Game): Status {
  if (g.phase === 'done') return 'done'
  if (g.players.some((p) => p.online)) return g.phase === 'waiting' ? 'waiting' : 'live'
  if (Date.now() - new Date(g.lastSeenAt).getTime() > ABANDONED_MS) return 'abandoned'
  return g.phase === 'waiting' ? 'waiting' : 'playing'
}

/** From creation to the end (or to the last time anyone had it open). */
function minutesOf(g: Game) {
  const end = new Date(g.endedAt ?? g.lastSeenAt).getTime()
  return Math.max(0, Math.round((end - new Date(g.createdAt).getTime()) / 60000))
}

const fmtMinutes = (m: number) =>
  m < 60 ? `${m} د` : `${Math.floor(m / 60)} س ${m % 60 ? `${m % 60} د` : ''}`

/** How far they got: questions for the chat games, turns for the board games. */
function progressOf(g: Game) {
  if (g.phase === 'waiting') return '—'
  if (g.board) return `الدورة ${g.board.turns}/${g.board.maxTurns}`
  const done = g.phase === 'done' ? g.questions : Math.min(g.currentIndex, g.questions)
  return `سؤال ${done}/${g.questions}`
}

/** How it ended (or where it stands): the match %, the wedding, the king of the gang. */
function resultOf(g: Game): React.ReactNode {
  const b = g.board
  if (b) {
    if (b.result) {
      if (!b.friends)
        return b.result.won
          ? `💍 وصلو للعرس في ${b.result.turns} دورة`
          : `😅 ما وصلوش (المربّع ${b.pos[0]?.square ?? 0})`
      const [first, ...rest] = b.result.ranking
      return (
        <span>
          👑 {first}
          {rest.length > 0 && (
            <span className="text-muted-foreground">
              {' '}
              · {rest.map((n, i) => `${['🥈', '🥉', '🏅'][i] ?? ''} ${n}`).join(' · ')}
            </span>
          )}
        </span>
      )
    }
    if (g.phase === 'waiting') return '—'
    return b.friends
      ? b.pos.map((p) => `${g.players.find((x) => x.id === p.id)?.name ?? '؟'} ${p.place ? '👑' : p.square}`).join(' · ')
      : `المربّع ${b.pos[0]?.square ?? 0}/${b.last}`
  }
  if (g.match) return `${g.match.score}% · ${matchWord(g.match.score)}`
  return '—'
}

function GamesPage() {
  return (
    <AdminShell>
      <LastGames />
    </AdminShell>
  )
}

/** The last 100 games, newest first, with what matters about each one. */
function LastGames() {
  const [games, setGames] = useState<Game[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<KindFilter>('all')

  useEffect(() => {
    let stop = false
    const load = () =>
      getAdminGames({ data: { mode: 'all', q: '', limit: LIMIT } })
        .then((r) => {
          if (stop) return
          setGames(r.games)
          setError(null)
        })
        .catch((e) => !stop && setError(e instanceof Error ? e.message : 'مشكل'))
    load()
    const id = window.setInterval(() => !document.hidden && load(), 15_000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [])

  const shown = (games ?? []).filter((g) => kind === 'all' || g.kind === kind)
  const statuses = shown.map(statusOf)
  const count = (s: Status) => statuses.filter((x) => x === s).length
  const finished = shown.filter((g) => g.phase === 'done')
  const avgMinutes = finished.length
    ? Math.round(finished.reduce((n, g) => n + minutesOf(g), 0) / finished.length)
    : null

  return (
    <div className="mt-8">
      <h1 className="font-display text-3xl font-bold">آخر {LIMIT} لعبة</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        الجديدة الأولى. تتحدّث وحدها كل 15 ثانية.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented options={FILTERS} value={kind} onChange={setKind} />
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {!games ? (
        <p className="mt-6 text-muted-foreground">لحظة…</p>
      ) : (
        <>
          {/* Summary of the games shown */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="ألعاب" value={shown.length} />
            <Stat
              label="كمّلو"
              value={count('done')}
              sub={shown.length ? `${Math.round((count('done') / shown.length) * 100)}%` : undefined}
            />
            <Stat label="يلعبو توّا" value={count('live')} />
            <Stat label="متروكة" value={count('abandoned')} />
            <Stat label="معدّل المدّة" value={avgMinutes != null ? fmtMinutes(avgMinutes) : '—'} />
          </div>

          <div className="mt-5 overflow-x-auto rounded-3xl border border-border bg-card/85">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border text-start">
                  <th className="px-3 py-2.5 text-start font-medium">وقتاش</th>
                  <th className="px-3 py-2.5 text-start font-medium">النوع</th>
                  <th className="px-3 py-2.5 text-start font-medium">اللاعبين</th>
                  <th className="px-3 py-2.5 text-start font-medium">الحالة</th>
                  <th className="px-3 py-2.5 text-start font-medium">التقدّم</th>
                  <th className="px-3 py-2.5 text-start font-medium">النتيجة</th>
                  <th className="px-3 py-2.5 text-start font-medium">المدّة</th>
                  <th className="px-3 py-2.5 text-start font-medium">جاو من</th>
                  <th className="px-3 py-2.5 text-start font-medium">الكود</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((g, i) => {
                  const st = STATUS[statuses[i]]
                  return (
                    <tr key={g.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div>{timeAgo(g.createdAt)}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {new Date(g.createdAt).toLocaleString('fr-TN', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {KIND[g.kind].icon} {KIND[g.kind].label}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {g.players.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                            >
                              {p.online && <span className="size-1.5 rounded-full bg-emerald-400" />}
                              {p.gender === 'female' ? '👩' : p.gender === 'male' ? '👨' : '👤'} {p.name}
                            </span>
                          ))}
                          {g.players.length < 2 && (
                            <span className="text-xs text-muted-foreground">ما دخل حد</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', st.className)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{progressOf(g)}</td>
                      <td className="px-3 py-2.5">{resultOf(g)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                        {g.players.length < 2 ? '—' : fmtMinutes(minutesOf(g))}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                        {g.source ? (SOURCE_LABEL[g.source] ?? g.source) : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">
                        {g.code}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {shown.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">حتى لعبة من النوع هذا.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/85 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums">
        {value}
        {sub && <span className="ms-1.5 text-xs font-normal text-muted-foreground">{sub}</span>}
      </div>
    </div>
  )
}
