import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Coins, Heart, Search, Users } from 'lucide-react'

import { AdminShell } from '@/components/admin-shell'
import { Input } from '@/components/ui/input'
import { getAdminMatchy } from '@/lib/admin.functions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin_/matchy')({
  head: () => ({
    meta: [
      { title: 'ماتشي — First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: MatchyAdminPage,
})

type Data = Awaited<ReturnType<typeof getAdminMatchy>>

function MatchyAdminPage() {
  return (
    <AdminShell>
      <MatchyAdmin />
    </AdminShell>
  )
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'توّا'
  if (m < 60) return `من ${m} د`
  const h = Math.floor(m / 60)
  if (h < 24) return `من ${h} سا`
  return `من ${Math.floor(h / 24)} يوم`
}

function MatchyAdmin() {
  const [data, setData] = useState<Data | null>(null)
  const [q, setQ] = useState('')

  const refresh = useCallback(async () => {
    setData(await getAdminMatchy().catch(() => null))
  }, [])

  useEffect(() => {
    const t = window.setTimeout(refresh, 0)
    const id = window.setInterval(() => {
      if (!document.hidden) refresh()
    }, 10000)
    return () => {
      window.clearTimeout(t)
      window.clearInterval(id)
    }
  }, [refresh])

  if (!data) return <p className="mt-6 text-muted-foreground">لحظة…</p>

  const { stats } = data
  const query = q.trim().toLowerCase()
  const users = query
    ? data.users.filter(
        (u) =>
          u.username.toLowerCase().includes(query) ||
          u.name.toLowerCase().includes(query),
      )
    : data.users

  return (
    <div className="mt-6 space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="لاعبين" value={stats.users} icon={<Users className="size-4" />} />
        <Tile
          label="متّصلين توّا"
          value={stats.online}
          tone="emerald"
          icon={<span className="size-2 rounded-full bg-emerald-400" />}
        />
        <Tile
          label="ماتشات"
          value={`${stats.matched}/${stats.matches}`}
          icon={<Heart className="size-4" />}
          hint="ناجحة / الكل"
        />
        <Tile label="أزواج أصحاب" value={stats.friendPairs} />
        <Tile
          label="كوان في المحافظ"
          value={stats.coinsInWallets}
          tone="gold"
          icon={<Coins className="size-4" />}
        />
        <Tile
          label="كوان مشرية"
          value={stats.coinsBought}
          tone="gold"
          hint={`${stats.revenueTnd} دينار`}
        />
        <Tile label="إعلانات تشافو" value={stats.adRewards} />
        <Tile label="كوان تنفقت في الماتشات" value={stats.coinsSpentOnMatches} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="لوّج على لاعب بالاسم ولا اسم المستخدم…"
          className="pe-9"
        />
      </div>

      {/* Users */}
      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="mb-3 text-sm font-semibold">
          اللاعبين ({users.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pe-3 text-start font-medium">اسم المستخدم</th>
                <th className="py-2 pe-3 text-start font-medium">الاسم</th>
                <th className="py-2 pe-3 text-start font-medium">العمر</th>
                <th className="py-2 pe-3 text-start font-medium">الجنس</th>
                <th className="py-2 pe-3 text-start font-medium">الكوان</th>
                <th className="py-2 pe-3 text-start font-medium">أصحاب</th>
                <th className="py-2 pe-3 text-start font-medium">ماتشات</th>
                <th className="py-2 text-start font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username} className="border-b border-border/50">
                  <td dir="ltr" className="py-2 pe-3 font-mono text-xs">
                    @{u.username}
                  </td>
                  <td className="py-2 pe-3">{u.name}</td>
                  <td className="py-2 pe-3 tabular-nums">{u.age ?? '—'}</td>
                  <td className="py-2 pe-3">
                    {u.gender === 'female' ? '👩' : u.gender === 'male' ? '👨' : '—'}
                  </td>
                  <td className="py-2 pe-3 font-semibold tabular-nums text-gold">
                    {u.coins}
                  </td>
                  <td className="py-2 pe-3 tabular-nums">{u.friends}</td>
                  <td className="py-2 pe-3 tabular-nums">{u.matches}</td>
                  <td className="py-2">
                    {u.online ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        متّصل
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {ago(u.lastSeenAt)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    ما فمّا حتى لاعب
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  icon,
  hint,
  tone,
}: {
  label: string
  value: number | string
  icon?: React.ReactNode
  hint?: string
  tone?: 'gold' | 'emerald'
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div
        className={cn(
          'mt-1 font-display text-2xl font-bold tabular-nums',
          tone === 'gold' && 'text-gold',
          tone === 'emerald' && 'text-emerald-400',
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}
