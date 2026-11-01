import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Check,
  Coins,
  LogOut,
  MessageCircle,
  Play,
  UserPlus,
  X,
} from 'lucide-react'

import { GenderPicker } from '@/components/gender-picker'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getMe, login, logout, signup } from '@/lib/account.functions'
import {
  cancelInvite,
  getLobby,
  respondInvite,
  startMatch,
} from '@/lib/match.functions'
import { getFriends } from '@/lib/chat.functions'
import {
  coinShopEnabled,
  redeemVoucher,
  startCoinPurchase,
} from '@/lib/coins.functions'
import { COIN_PACKS } from '@/lib/coin-packs'
import { saveToken } from '@/lib/session'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/matchy')({
  head: () => ({
    meta: [{ title: 'ماتشي · First Date على الطريقة التونسية' }],
  }),
  component: MatchyPage,
})

// The common account shape returned by getMe / login / signup (birthday is extra on getMe)
type Me = {
  id: number
  username: string
  name: string
  coins: number
  gender: 'male' | 'female' | null
}

function MatchyPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined)

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null))
  }, [])

  if (me === undefined)
    return (
      <div className="glow-bg grid min-h-dvh place-items-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="typing-dot size-2.5 rounded-full bg-primary"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    )

  return (
    <div className="glow-bg min-h-dvh">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <header className="mb-6 flex items-center justify-between">
          <Logo />
          {me && (
            <button
              type="button"
              onClick={async () => {
                await logout()
                setMe(null)
              }}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <LogOut className="size-3.5" /> خروج
            </button>
          )}
        </header>

        {me ? (
          <Lobby me={me} onCoins={(coins) => setMe({ ...me, coins })} />
        ) : (
          <AuthPanel onDone={setMe} />
        )}
      </div>
    </div>
  )
}

/* ---------------------------------- Auth ---------------------------------- */

function AuthPanel({ onDone }: { onDone: (me: Me) => void }) {
  const [tab, setTab] = useState<'signup' | 'login'>('signup')
  return (
    <div className="surface mx-auto max-w-md rounded-3xl p-6">
      <div className="text-center">
        <div className="eyebrow">ماتشي 💘</div>
        <h1 className="mt-1 font-display text-2xl font-bold">
          العب ماتشي مع ناس جداد
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          احسب التفاهم، وكي يطلع 50% وفوق تولّيو أصحاب وتحكيو مع بعضكم.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1 text-sm">
        {(['signup', 'login'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg py-2 font-medium transition-colors',
              tab === t
                ? 'bg-background shadow'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'signup' ? 'حساب جديد' : 'دخول'}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'signup' ? (
          <SignupForm onDone={onDone} />
        ) : (
          <LoginForm onDone={onDone} />
        )}
      </div>
    </div>
  )
}

function SignupForm({ onDone }: { onDone: (me: Me) => void }) {
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [password, setPassword] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('اكتب اسمك')
    if (!birthday) return toast.error('اختار تاريخ ميلادك')
    if (password.length < 6) return toast.error('الباسوورد لازم 6 حروف على الأقل')
    setBusy(true)
    try {
      const me = await signup({
        data: { name: name.trim(), birthday, password, gender },
      })
      toast.success(`أهلا ${me.name}! اسم المستخدم متاعك: ${me.username}`)
      onDone(me)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          الاسم
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسمك"
          maxLength={24}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          تاريخ الميلاد
        </label>
        <Input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          الباسوورد
        </label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6 حروف على الأقل"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          إنتي راجل ولا مرا؟ (اختياري)
        </label>
        <GenderPicker value={gender} onChange={setGender} />
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="btn-love w-full rounded-xl py-5 text-base"
      >
        <UserPlus className="me-1 size-4" />
        {busy ? 'نحضّرو الحساب…' : 'اعمل حساب'}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        باش نعطيوك اسم مستخدم تلقائي، ونبداو رصيدك بـ 3000 كوان 🎁
      </p>
    </form>
  )
}

function LoginForm({ onDone }: { onDone: (me: Me) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const me = await login({
        data: { username: username.trim().toLowerCase(), password },
      })
      onDone(me)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          اسم المستخدم
        </label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="مثلا habib_4821"
          dir="ltr"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          الباسوورد
        </label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="btn-love w-full rounded-xl py-5 text-base"
      >
        {busy ? 'ندخلو…' : 'دخول'}
      </Button>
    </form>
  )
}

/* --------------------------------- Lobby --------------------------------- */

type Lobby = Awaited<ReturnType<typeof getLobby>>
type Friends = Awaited<ReturnType<typeof getFriends>>

const g = (gender: string | null, male: string, female: string) =>
  gender === 'female' ? female : male

function Lobby({
  me,
  onCoins,
}: {
  me: NonNullable<Me>
  onCoins: (coins: number) => void
}) {
  const nav = useNavigate()
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [friends, setFriends] = useState<Friends>([])
  const [busyWith, setBusyWith] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [l, f] = await Promise.all([getLobby(), getFriends()])
      setLobby(l)
      setFriends(f)
      onCoins(l.coins)
    } catch {
      // keep the last view on a transient error
    }
  }, [onCoins])

  useEffect(() => {
    const first = window.setTimeout(refresh, 0)
    const id = window.setInterval(() => {
      if (!document.hidden) refresh()
    }, 5000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [refresh])

  async function play(username: string) {
    setBusyWith(username)
    try {
      const r = await startMatch({ data: { username } })
      saveToken(r.code, r.token)
      nav({ to: '/room/$code', params: { code: r.code } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل')
      setBusyWith(null)
    }
  }

  async function respond(id: number, accept: boolean) {
    try {
      const r = await respondInvite({ data: { id, accept } })
      if (r.accepted) {
        saveToken(r.code, r.token)
        nav({ to: '/room/$code', params: { code: r.code } })
      } else {
        toast('رفضت الدعوة')
        refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل')
      refresh()
    }
  }

  return (
    <div className="space-y-5">
      {/* Coins + name */}
      <div className="surface flex items-center justify-between rounded-2xl p-4">
        <div className="min-w-0">
          <div className="truncate font-semibold">أهلا {me.name} 👋</div>
          <div dir="ltr" className="truncate text-xs text-muted-foreground">
            @{me.username}
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 font-bold text-gold">
          <Coins className="size-4" />
          <span className="tabular-nums">{lobby?.coins ?? me.coins}</span>
        </div>
      </div>

      {/* Buy coins (Flouci) + redeem a voucher code */}
      <BuyCoins />
      <RedeemBox onCoins={onCoins} />

      {/* Incoming invites */}
      {lobby?.incoming.map((inv) => (
        <div
          key={inv.id}
          className="surface flex items-center justify-between gap-3 rounded-2xl border border-primary/40 p-4"
        >
          <div className="min-w-0">
            <div className="text-sm">
              💌 <span className="font-semibold">{inv.name}</span>
              {inv.age != null && (
                <span className="text-muted-foreground"> · {inv.age} سنة</span>
              )}{' '}
              {g(inv.gender, 'عزمك', 'عزمتك')} للعبة ماتشي
            </div>
            <div dir="ltr" className="text-xs text-muted-foreground">
              @{inv.username}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => respond(inv.id, true)}
              className="btn-love grid size-9 place-items-center rounded-full text-white"
              aria-label="اقبل"
            >
              <Check className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => respond(inv.id, false)}
              className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
              aria-label="ارفض"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Outgoing pending */}
      {lobby?.outgoing && (
        <div className="surface flex items-center justify-between gap-3 rounded-2xl p-4">
          <div className="text-sm">
            ⌛ تستنّى <span className="font-semibold">{lobby.outgoing.name}</span>{' '}
            يقبل…
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() =>
                nav({
                  to: '/room/$code',
                  params: { code: lobby.outgoing!.code },
                })
              }
              className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary"
            >
              ارجع للعبة
            </button>
            <button
              type="button"
              onClick={async () => {
                await cancelInvite({ data: { id: lobby.outgoing!.id } })
                refresh()
              }}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              ألغي
            </button>
          </div>
        </div>
      )}

      {/* Who is free now */}
      <section>
        <div className="eyebrow mb-2">مين فاضي توّا</div>
        {!lobby ? (
          <div className="text-sm text-muted-foreground">نحمّلو…</div>
        ) : lobby.free.length === 0 ? (
          <div className="surface rounded-2xl p-5 text-center text-sm text-muted-foreground">
            حتى حد موش متّصل توّا. ارجع بعد شويّة 🙌
          </div>
        ) : (
          <div className="space-y-2">
            {lobby.free.map((p) => (
              <div
                key={p.username}
                className="surface flex items-center justify-between gap-3 rounded-2xl p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-full font-display font-bold text-white',
                      p.gender === 'female' ? 'bg-love' : 'bubble-friends',
                    )}
                  >
                    {p.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {p.name}
                      {p.age != null && (
                        <span className="ms-1 text-xs font-normal text-muted-foreground">
                          · {p.age}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      متّصل توّا
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => play(p.username)}
                  disabled={busyWith != null}
                  className="btn-love shrink-0 rounded-xl"
                >
                  <Play className="me-1 size-4" />
                  {busyWith === p.username ? '…' : 'ألعب'}
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          كل لعبة تنجّم تكلّفك من 2000 لـ 3000 كوان كي تعملو ماتش، و100 كوان كي ما
          تعملوش. يتنحّى من اللي يعزم برك.
        </p>
      </section>

      {/* Friends / chats */}
      <section>
        <div className="eyebrow mb-2">الأصحاب والدردشة</div>
        {friends.length === 0 ? (
          <div className="surface rounded-2xl p-5 text-center text-sm text-muted-foreground">
            مازال ما عندكش أصحاب. العب ماتشي وكي يطلع 50% وفوق تولّيو أصحاب 💘
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <Link
                key={f.username}
                to="/matchy/chat/$username"
                params={{ username: f.username }}
                className="surface flex items-center justify-between gap-3 rounded-2xl p-3 hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative">
                    <div
                      className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-full font-display font-bold text-white',
                        f.gender === 'female' ? 'bg-love' : 'bubble-friends',
                      )}
                    >
                      {f.name[0]}
                    </div>
                    {f.online && (
                      <span className="absolute -bottom-0.5 -end-0.5 size-3 rounded-full border-2 border-card bg-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {f.name}
                      {f.age != null && (
                        <span className="ms-1 text-xs font-normal text-muted-foreground">
                          · {f.age}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {f.lastMessage ?? 'ابدا الدردشة…'}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {f.unread > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
                      {f.unread}
                    </span>
                  )}
                  <MessageCircle className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function BuyCoins() {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    coinShopEnabled()
      .then((r) => setEnabled(r.enabled))
      .catch(() => {})
  }, [])

  if (!enabled) return null

  async function buy(packId: string) {
    setBusy(packId)
    try {
      const r = await startCoinPurchase({ data: { packId } })
      window.location.assign(r.link)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل')
      setBusy(null)
    }
  }

  return (
    <div className="surface rounded-2xl p-3">
      <div className="mb-2 text-center text-sm font-semibold">اشري كوان 💰</div>
      <div className="grid grid-cols-2 gap-2">
        {COIN_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => buy(p.id)}
            disabled={busy != null}
            className="rounded-xl border border-border bg-card/60 p-3 text-center transition-colors hover:border-gold/60 disabled:opacity-60"
          >
            <div className="font-display text-lg font-bold tabular-nums text-gold">
              {p.coins}
            </div>
            <div className="text-[11px] text-muted-foreground">كوان</div>
            {p.bonus ? (
              <div className="mt-0.5 text-[11px] text-emerald-400">
                +{p.bonus} هدية
              </div>
            ) : null}
            <div className="mt-1 rounded-full bg-primary/10 py-0.5 text-xs font-medium text-primary">
              {busy === p.id ? '…' : p.label}
            </div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        خلّص بـ D17، المحفظة، e-DINAR ولا كارت 💳
      </p>
    </div>
  )
}

function RedeemBox({ onCoins }: { onCoins: (coins: number) => void }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    try {
      const r = await redeemVoucher({ data: { code } })
      onCoins(r.coins)
      setCode('')
      setOpen(false)
      toast.success(`تشحن رصيدك بـ ${r.added} كوان 🎉`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل')
    } finally {
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gold/50 py-3 text-sm font-medium text-gold hover:bg-gold/10"
      >
        <Coins className="size-4" /> اشحن رصيدك بكود
      </button>
    )

  return (
    <form onSubmit={submit} className="surface rounded-2xl p-3">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="FD-XXXX-XXXX"
          dir="ltr"
          autoFocus
          maxLength={40}
          className="flex-1 uppercase"
        />
        <Button
          type="submit"
          disabled={busy || !code.trim()}
          className="btn-love rounded-xl"
        >
          {busy ? '…' : 'اشحن'}
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        عندك كود شحن؟ اكتبو هنا. (1000 كوان = 1 دينار)
      </p>
    </form>
  )
}
