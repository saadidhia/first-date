import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BarChart3, LogOut, MessageCircleHeart } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminUser, loginAdmin, logoutAdmin } from '@/lib/admin.functions'
import { cn } from '@/lib/utils'

type AdminUser = Awaited<ReturnType<typeof getAdminUser>>

/** Page frame shared by the admin pages: login gate, tabs between them, signed-in email and logout. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | undefined>(undefined)

  const loadUser = useCallback(async () => {
    setUser(await getAdminUser().catch(() => null))
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  let body: React.ReactNode
  if (user === undefined) {
    body = <p className="text-center text-muted-foreground">لحظة…</p>
  } else if (!user) {
    body = <LoginForm onDone={loadUser} />
  } else {
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex gap-1 rounded-2xl border border-border bg-card/60 p-1">
            <Tab to="/admin" icon={<MessageCircleHeart className="size-4" />} label="الرسائل" />
            <Tab to="/admin/stats" icon={<BarChart3 className="size-4" />} label="الإحصائيات" />
          </nav>
          <span className="text-sm text-muted-foreground" dir="ltr">
            {user.email}
          </span>
        </div>
        {children}
        <LogoutButton onDone={loadUser} />
      </>
    )
  }

  return (
    <div className="glow-bg min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Link to="/">
          <Logo />
        </Link>
        <span className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          لوحة الإدارة
        </span>
      </header>
      <main className="mx-auto mt-14 max-w-3xl">{body}</main>
    </div>
  )
}

function Tab({ to, icon, label }: { to: '/admin' | '/admin/stats'; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      activeProps={{ className: 'bg-primary/15 font-semibold !text-foreground' }}
    >
      {icon} {label}
    </Link>
  )
}

function LoginForm({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await loginAdmin({ data: { email: String(f.get('email')), password: String(f.get('password')) } })
      await onDone()
    } catch {
      setError('الإيمايل ولا كلمة السر غالطين.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-sm space-y-3 rounded-3xl border border-border bg-card/90 p-6"
    >
      <h1 className="text-center font-display text-2xl font-bold">دخول الأدمين</h1>
      <Input name="email" type="email" dir="ltr" required autoComplete="email" placeholder="email@example.com" className="h-12 rounded-xl" />
      <Input name="password" type="password" dir="ltr" required autoComplete="current-password" placeholder="••••••••" className="h-12 rounded-xl" />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="btn-love h-12 w-full rounded-xl font-semibold">
        {busy ? 'لحظة…' : 'ادخل'}
      </Button>
    </form>
  )
}

function LogoutButton({ onDone }: { onDone: () => Promise<void> }) {
  return (
    <Button
      variant="secondary"
      className="mt-4 rounded-xl"
      onClick={async () => {
        await logoutAdmin().catch(() => {})
        await onDone()
      }}
    >
      <LogOut className="size-4" /> خروج
    </Button>
  )
}

export function StatCard({
  icon,
  label,
  hint,
  value,
  live,
  className,
}: {
  icon: React.ReactNode
  label: string
  hint: React.ReactNode
  value: string
  live?: boolean
  className?: string
}) {
  return (
    <div className={cn('rounded-3xl border border-border bg-card/85 p-6', className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon} {label}
        {live && <span className="ms-auto size-2 animate-pulse rounded-full bg-emerald-400" />}
      </div>
      <div className="mt-3 font-display text-5xl font-bold tabular-nums">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
