import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  acceptInvite,
  handleAuthCallback,
  login,
  logout,
  signup,
  updateUser,
} from '@netlify/identity'
import { Check, Clock, Copy, LogOut, MessageCircleHeart, Radio, Share2, Trash2, Users } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminStats, getAdminUser } from '@/lib/admin.functions'
import {
  deleteSecretMessage,
  getSecretMessages,
  markSecretMessagesRead,
} from '@/lib/secret.functions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'لوحة الإدارة — First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AdminPage,
})

type AdminUser = Awaited<ReturnType<typeof getAdminUser>>
type Stats = Awaited<ReturnType<typeof getAdminStats>>
// Invite and recovery links land here with a token in the URL hash
type Pending = { kind: 'invite'; token: string } | { kind: 'recovery' } | null

function AdminPage() {
  const [user, setUser] = useState<AdminUser | undefined>(undefined)
  const [pending, setPending] = useState<Pending>(null)

  const loadUser = useCallback(async () => {
    setUser(await getAdminUser().catch(() => null))
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const cb = await handleAuthCallback()
        if (cb?.type === 'invite' && cb.token)
          setPending({ kind: 'invite', token: cb.token })
        else if (cb?.type === 'recovery') setPending({ kind: 'recovery' })
      } catch {
        // Expired or already used link: fall back to the login form
      }
      await loadUser()
    })()
  }, [loadUser])

  let body: React.ReactNode
  if (pending) {
    body = (
      <SetPassword
        pending={pending}
        onDone={async () => {
          setPending(null)
          await loadUser()
        }}
      />
    )
  } else if (user === undefined) {
    body = <p className="text-center text-muted-foreground">لحظة…</p>
  } else if (!user) {
    body = <LoginForm onDone={loadUser} />
  } else if (!user.isAdmin) {
    body = (
      <div className="text-center">
        <p className="font-semibold">الحساب هذا ({user.email}) ما عندوش صلاحية أدمين.</p>
        <LogoutButton onDone={loadUser} />
      </div>
    )
  } else {
    body = <Dashboard email={user.email} onLogout={loadUser} />
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

function LoginForm({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const email = String(f.get('email'))
    const password = String(f.get('password'))
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signup') {
        const user = await signup(email, password)
        if (!user.confirmedAt) {
          setNotice('بعثنالك إيمايل، أكّد الحساب من الرابط اللي فيه وبعد ادخل.')
          setMode('login')
          return
        }
      } else {
        await login(email, password)
      }
      await onDone()
    } catch {
      setError(
        mode === 'signup'
          ? 'ما نجمناش نعملو الحساب. الإيمايل هذا ما عندوش الحق، ولا الحساب موجود ديجا.'
          : 'الإيمايل ولا كلمة السر غالطين، ولا الحساب مازال ما تأكّدش.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-sm space-y-3 rounded-3xl border border-border bg-card/90 p-6"
    >
      <h1 className="text-center font-display text-2xl font-bold">
        {mode === 'login' ? 'دخول الأدمين' : 'حساب أدمين جديد'}
      </h1>
      <Input name="email" type="email" dir="ltr" required autoComplete="email" placeholder="email@example.com" className="h-12 rounded-xl" />
      <Input name="password" type="password" dir="ltr" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} placeholder="••••••••" className="h-12 rounded-xl" />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}
      <Button type="submit" disabled={busy} className="btn-love h-12 w-full rounded-xl font-semibold">
        {busy ? 'لحظة…' : mode === 'login' ? 'ادخل' : 'اعمل الحساب'}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {mode === 'login' ? 'أوّل مرّة؟ اعمل حساب' : 'عندي حساب، نحب ندخل'}
      </button>
    </form>
  )
}

function SetPassword({ pending, onDone }: { pending: NonNullable<Pending>; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const password = String(new FormData(e.currentTarget).get('password'))
    setBusy(true)
    setError(null)
    try {
      if (pending.kind === 'invite') await acceptInvite(pending.token, password)
      else await updateUser({ password })
      await onDone()
    } catch {
      setError('ما نجمناش نسجّلو كلمة السر. جرّب كلمة سر أطول ولا اطلب رابط جديد.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-sm space-y-3 rounded-3xl border border-border bg-card/90 p-6"
    >
      <h1 className="text-center font-display text-2xl font-bold">
        {pending.kind === 'invite' ? 'اختار كلمة سر للحساب' : 'كلمة سر جديدة'}
      </h1>
      <Input name="password" type="password" dir="ltr" required minLength={8} autoComplete="new-password" placeholder="••••••••" className="h-12 rounded-xl" />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="btn-love h-12 w-full rounded-xl font-semibold">
        {busy ? 'لحظة…' : 'سجّل'}
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
        await logout().catch(() => {})
        await onDone()
      }}
    >
      <LogOut className="size-4" /> خروج
    </Button>
  )
}

function Dashboard({ email, onLogout }: { email: string; onLogout: () => Promise<void> }) {
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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">الإحصائيات</h1>
        <span className="text-sm text-muted-foreground" dir="ltr">
          {email}
        </span>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
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
      </div>
      <SecretInbox />
      {stats && <RecentList people={stats.recent} />}
      <p className="mt-4 text-xs text-muted-foreground">
        تتحدّث وحدها كل 10 ثواني
        {stats && ` · آخر تحديث ${new Date(stats.at).toLocaleTimeString('ar-TN')}`}
      </p>
      <LogoutButton onDone={onLogout} />
    </div>
  )
}

type SecretMessage = Awaited<ReturnType<typeof getSecretMessages>>[number]

/** The public /sir link to share (e.g. as a link sticker in an Instagram story) and the messages it got. */
function SecretInbox() {
  const [messages, setMessages] = useState<SecretMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [link, setLink] = useState('')

  useEffect(() => {
    setLink(`${window.location.origin}/sir`)
    let stop = false
    const load = () =>
      getSecretMessages()
        .then((m) => {
          if (stop) return
          setMessages(m)
          setError(null)
        })
        .catch((e) => !stop && setError(e instanceof Error ? e.message : 'مشكل'))
    load()
    const id = window.setInterval(() => !document.hidden && load(), 30_000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [])

  const unread = messages?.filter((m) => m.unread).length ?? 0

  async function copy() {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: 'ابعثلي رسالة سرّية 🤫', url: link }).catch(() => {})
    } else {
      await copy()
    }
  }

  async function markRead() {
    await markSecretMessagesRead().catch(() => {})
    setMessages((list) => list?.map((m) => ({ ...m, unread: false })) ?? null)
  }

  async function remove(id: number) {
    if (!window.confirm('تفسخ الرسالة هذي؟')) return
    await deleteSecretMessage({ data: { id } })
      .then(() => setMessages((list) => list?.filter((m) => m.id !== id) ?? null))
      .catch(() => setError('ما نجمناش نفسخو الرسالة'))
  }

  return (
    <section className="mt-8 rounded-3xl border border-primary/30 bg-card/85 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircleHeart className="size-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">الرسائل السرّية</h2>
        {unread > 0 && (
          <span className="bg-love rounded-full px-2 py-0.5 text-xs font-bold text-white">
            {unread} جديدة
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        حطّ الرابط هذا في ستوري إنستا (sticker «Lien») ولا في أي بلاصة. اللي يكتبلك يحطّ اسم حسابو في
        إنستا، ويتقالو إنّك تشوفو.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2.5 text-sm">
          {link || '…/sir'}
        </code>
        <Button variant="secondary" className="rounded-xl" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'تنسخ' : 'انسخ'}
        </Button>
        <Button className="btn-love rounded-xl" onClick={share}>
          <Share2 className="size-4" /> برتاجي
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {messages && messages.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">مازال حتى رسالة. برتاجي الرابط 😉</p>
      )}
      {messages && messages.length > 0 && (
        <>
          {unread > 0 && (
            <button
              type="button"
              onClick={markRead}
              className="mt-4 text-xs text-muted-foreground hover:text-foreground"
            >
              علّم الكل مقروء
            </button>
          )}
          <ul className="mt-2 space-y-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  'rounded-2xl border p-3',
                  m.unread ? 'border-primary/40 bg-primary/10' : 'border-border bg-background/40',
                )}
              >
                <div className="flex items-center gap-2 text-xs">
                  {m.instagram ? (
                    <a
                      href={`https://instagram.com/${m.instagram}`}
                      target="_blank"
                      rel="noreferrer"
                      dir="ltr"
                      className="font-semibold text-gold hover:underline"
                    >
                      @{m.instagram}
                    </a>
                  ) : (
                    <span className="font-semibold text-gold">مجهول{m.source ? ` · من ${m.source}` : ''}</span>
                  )}
                  <span className="text-muted-foreground">· {new Date(m.createdAt).toLocaleString('ar-TN')}</span>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="ms-auto text-muted-foreground hover:text-destructive"
                    aria-label="افسخ"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
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

function StatCard({
  icon,
  label,
  hint,
  value,
  live,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  value: string
  live?: boolean
}) {
  return (
    <div className="rounded-3xl border border-border bg-card/85 p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon} {label}
        {live && <span className="ms-auto size-2 animate-pulse rounded-full bg-emerald-400" />}
      </div>
      <div className="mt-3 font-display text-5xl font-bold tabular-nums">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
