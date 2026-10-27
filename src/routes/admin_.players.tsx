import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Search, Users } from 'lucide-react'

import { GameRow, PairLegend } from '@/components/admin-games'
import { AdminShell, Segmented } from '@/components/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminGames } from '@/lib/admin.functions'

export const Route = createFileRoute('/admin_/players')({
  head: () => ({
    meta: [
      { title: 'اللاعبين — First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: PlayersPage,
})

type ModeFilter = 'all' | 'date' | 'friends'
type Result = Awaited<ReturnType<typeof getAdminGames>>

const MODES: { value: ModeFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'date', label: '💘 كوبل' },
  { value: 'friends', label: '🤝 صحاب' },
]
const PAGE = 50

function PlayersPage() {
  return (
    <AdminShell>
      <GameList />
    </AdminShell>
  )
}

/** Every game, newest first: who played with who. */
function GameList() {
  const [mode, setMode] = useState<ModeFilter>('all')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Wait until typing stops before searching
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQ(search.trim())
      setLimit(PAGE)
    }, 300)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => {
    let stop = false
    const load = () =>
      getAdminGames({ data: { mode, q, limit } })
        .then((r) => {
          if (stop) return
          setResult(r)
          setError(null)
        })
        .catch((e) => !stop && setError(e instanceof Error ? e.message : 'مشكل'))
    load()
    const id = window.setInterval(() => !document.hidden && load(), 15_000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [mode, q, limit])

  return (
    <div className="mt-8">
      <h1 className="font-display text-3xl font-bold">شكون لعب مع شكون</h1>
      <p className="mt-1 text-sm text-muted-foreground">اللاعبين اللي لعبو مع بعضهم مربوطين بخيط.</p>

      <section className="mt-6 rounded-3xl border border-border bg-card/85 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            options={MODES}
            value={mode}
            onChange={(m) => {
              setMode(m)
              setLimit(PAGE)
            }}
          />
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="لوّج على اسم…"
              className="h-9 rounded-xl ps-9"
            />
          </div>
        </div>
        <div className="mt-3">
          <PairLegend />
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {!result ? (
          <p className="mt-4 text-sm text-muted-foreground">لحظة…</p>
        ) : result.games.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" /> حتى لعبة{q ? ` فيها «${q}»` : ''}.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {result.games.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </ul>
        )}
        {result?.more && (
          <Button variant="secondary" className="mt-3 w-full rounded-xl" onClick={() => setLimit((n) => n + PAGE)}>
            ورّيني أكثر
          </Button>
        )}
      </section>
    </div>
  )
}
