import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Check, Copy, Ticket } from 'lucide-react'

import { AdminShell } from '@/components/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminCreateVouchers,
  adminListVouchers,
  adminTopUp,
  coinShopEnabled,
} from '@/lib/coins.functions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin_/coins')({
  head: () => ({
    meta: [
      { title: 'الكوان — First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: CoinsPage,
})

type List = Awaited<ReturnType<typeof adminListVouchers>>

function CoinsPage() {
  return (
    <AdminShell>
      <Coins />
    </AdminShell>
  )
}

function Coins() {
  const [list, setList] = useState<List | null>(null)
  const [generated, setGenerated] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [flouci, setFlouci] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    setList(await adminListVouchers().catch(() => null))
  }, [])

  useEffect(() => {
    const t = window.setTimeout(refresh, 0)
    coinShopEnabled()
      .then((r) => setFlouci(r.enabled))
      .catch(() => setFlouci(false))
    return () => window.clearTimeout(t)
  }, [refresh])

  return (
    <div className="mt-6 space-y-6">
      {/* Flouci payment status */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">دفع فلوسي (شراء كوان):</span>
        {flouci == null ? (
          <span className="text-muted-foreground">…</span>
        ) : flouci ? (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            ● مفعّل
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            ○ معطّل — زيد FLOUCI_PUBLIC_KEY و FLOUCI_PRIVATE_KEY
          </span>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <GenerateCard
          onDone={(codes) => {
            setGenerated(codes)
            setCopied(false)
            refresh()
          }}
        />
        <TopUpCard onDone={refresh} />
      </div>

      {generated.length > 0 && (
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-gold">
              {generated.length} كود جداد 🎟️
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(generated.join('\n'))
                  .then(() => {
                    setCopied(true)
                    toast.success('تنسخو')
                  })
                  .catch(() => toast.error('ما تنسخش'))
              }}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              انسخ الكل
            </button>
          </div>
          <div
            dir="ltr"
            className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-3"
          >
            {generated.map((c) => (
              <span key={c} className="rounded bg-background/60 px-2 py-1">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <RecentVouchers list={list} />
    </div>
  )
}

function GenerateCard({ onDone }: { onDone: (codes: string[]) => void }) {
  const [coins, setCoins] = useState(3000)
  const [count, setCount] = useState(10)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await adminCreateVouchers({
        data: { coins, count, note: note.trim() || undefined },
      })
      onDone(r.codes)
      toast.success(`تعملو ${r.codes.length} كود`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'مشكل')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-border bg-card/60 p-4"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <Ticket className="size-4 text-gold" /> اعمل أكواد شحن
      </h2>
      <label className="block text-xs text-muted-foreground">
        قيمة كل كود (كوان)
        <Input
          type="number"
          min={1}
          value={coins}
          onChange={(e) => setCoins(Number(e.target.value))}
          className="mt-1"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        العدد
        <Input
          type="number"
          min={1}
          max={200}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="mt-1"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        ملاحظة (اختياري)
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثلا: انستغرام سبتمبر"
          className="mt-1"
          maxLength={60}
        />
      </label>
      <Button type="submit" disabled={busy} className="btn-love w-full rounded-xl">
        {busy ? '…' : 'اعمل الأكواد'}
      </Button>
    </form>
  )
}

function TopUpCard({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('')
  const [coins, setCoins] = useState(3000)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return toast.error('اكتب اسم المستخدم')
    setBusy(true)
    try {
      const r = await adminTopUp({
        data: { username: username.trim().toLowerCase(), coins },
      })
      toast.success(`${r.name}: رصيدو توّا ${r.coins} كوان`)
      setUsername('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'مشكل')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-border bg-card/60 p-4"
    >
      <h2 className="font-semibold">اشحن لاعب مباشرة</h2>
      <label className="block text-xs text-muted-foreground">
        اسم المستخدم
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="habib_4821"
          dir="ltr"
          className="mt-1"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        الكوان
        <Input
          type="number"
          min={1}
          value={coins}
          onChange={(e) => setCoins(Number(e.target.value))}
          className="mt-1"
        />
      </label>
      <Button type="submit" disabled={busy} className="w-full rounded-xl">
        {busy ? '…' : 'زيد الكوان'}
      </Button>
    </form>
  )
}

function RecentVouchers({ list }: { list: List | null }) {
  if (!list) return <p className="text-sm text-muted-foreground">لحظة…</p>
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center gap-4 text-sm">
        <span className="font-semibold">آخر الأكواد</span>
        <span className="text-emerald-400">{list.unused} مازال</span>
        <span className="text-muted-foreground">{list.redeemed} تستعملو</span>
      </div>
      {list.vouchers.length === 0 ? (
        <p className="text-sm text-muted-foreground">مازال ما فمّا أكواد.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border text-start">
                <th className="py-2 pe-3 text-start font-medium">الكود</th>
                <th className="py-2 pe-3 text-start font-medium">الكوان</th>
                <th className="py-2 pe-3 text-start font-medium">الحالة</th>
                <th className="py-2 text-start font-medium">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {list.vouchers.map((v) => (
                <tr key={v.code} className="border-b border-border/50">
                  <td className="py-2 pe-3 font-mono">
                    <span dir="ltr">{v.code}</span>
                  </td>
                  <td className="py-2 pe-3 tabular-nums">{v.coins}</td>
                  <td className="py-2">
                    {v.redeemedBy ? (
                      <span
                        className={cn(
                          'rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground',
                        )}
                      >
                        {v.redeemedBy}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                        مازال
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {v.note ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
