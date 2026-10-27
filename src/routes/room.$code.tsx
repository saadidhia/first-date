import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowRight,
  Check,
  Copy,
  Lock,
  Send,
  Share2,
  ShieldAlert,
} from 'lucide-react'

import { GenderPicker } from '@/components/gender-picker'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getMyResult,
  getRoomPreview,
  getRoomState,
  joinRoom,
  playJoker,
  reportScreenshot,
  spin,
  startRoom,
  submitAnswer,
} from '@/lib/room.functions'
import {
  type Gender,
  addSeenQuestions,
  getSavedGender,
  getSavedName,
  getSeenQuestions,
  getToken,
  saveGender,
  saveName,
  saveToken,
} from '@/lib/session'
import { useScreenshotGuard } from '@/lib/use-screenshot-guard'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/room/$code')({
  head: () => ({
    meta: [{ title: 'اللعبة · First Date على الطريقة التونسية' }],
  }),
  component: RoomPage,
})

type RoomState = Awaited<ReturnType<typeof getRoomState>>
type Result = Awaited<ReturnType<typeof getMyResult>>

function RoomPage() {
  const { code: rawCode } = Route.useParams()
  const code = rawCode.toUpperCase()
  const [token, setToken] = useState<string | null | undefined>(undefined)

  useEffect(() => setToken(getToken(code)), [code])

  if (token === undefined) return <FullScreenLoader />
  if (!token) return <JoinGate code={code} onJoined={setToken} />
  return <ChatRoom code={code} token={token} />
}

function FullScreenLoader() {
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
}

/* ---------------------------------- Join ---------------------------------- */

function JoinGate({
  code,
  onJoined,
}: {
  code: string
  onJoined: (t: string) => void
}) {
  const [preview, setPreview] = useState<
    Awaited<ReturnType<typeof getRoomPreview>> | undefined
  >()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(getSavedName())
    setGender(getSavedGender())
    getRoomPreview({ data: { code } })
      .then(setPreview)
      .catch(() => setPreview(null))
  }, [code])

  async function join(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('اكتب اسمك قبل ما تدخل')
    if (!gender) return toast.error('اختار راجل ولا مرا')
    setBusy(true)
    try {
      const res = await joinRoom({ data: { code, name, gender } })
      addSeenQuestions(res.questionIds)
      saveName(name.trim())
      saveGender(gender)
      saveToken(res.code, res.token)
      onJoined(res.token)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل، عاود جرّب')
      setBusy(false)
    }
  }

  return (
    <div className="glow-bg grid min-h-dvh place-items-center px-5">
      <div className="surface w-full max-w-sm overflow-hidden rounded-3xl text-center backdrop-blur">
        <div className="relative h-36">
          <img
            src="/wedding-hero.webp"
            alt=""
            className="size-full object-cover object-[50%_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
        <div className="-mt-6 px-6 pb-6">
          <div className="relative flex justify-center">
            <Logo />
          </div>
          {preview === undefined ? (
            <p className="mt-8 text-muted-foreground">نحضّرو اللعبة…</p>
          ) : preview === null ? (
            <>
              <p className="mt-8 text-lg font-semibold">
                ما لقيناش حتى لعبة بالكود هذا
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                ثبّت في الكود اللي وصلك، ولا ابدا لعبة جديدة.
              </p>
              <Button
                asChild
                className="bg-love mt-6 w-full rounded-xl text-white"
              >
                <Link to="/">رجوع للصفحة الرئيسية</Link>
              </Button>
            </>
          ) : preview.full || preview.started ? (
            <>
              <p className="mt-8 text-lg font-semibold">
                {preview.started ? 'اللعبة بدات' : 'اللعبة هذي كاملة'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {preview.started
                  ? 'ما عادش تنجم تدخل. تنجم تبدا لعبة متاعك.'
                  : preview.mode === 'friends'
                    ? `فيها ${preview.maxPlayers} ديجا. تنجم تبدا لعبة متاعك.`
                    : 'فيها زوز لاعبين ديجا. تنجم تبدا لعبة متاعك.'}
              </p>
              <Button
                asChild
                className="bg-love mt-6 w-full rounded-xl text-white"
              >
                <Link to="/">ابدا لعبة جديدة</Link>
              </Button>
            </>
          ) : (
            <form onSubmit={join}>
              <div className="bg-love mx-auto mt-8 grid size-16 place-items-center rounded-full font-display text-2xl font-bold text-white">
                {preview.hostName?.[0] ?? '💘'}
              </div>
              <p className="mt-4 text-lg">
                <strong>{preview.hostName}</strong>{' '}
                {preview.hostGender === 'female' ? 'تستنّى' : 'يستنّى'} فيك 💌
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                30 سؤال، تجاوبو في نفس الوقت، وفي الآخر كل واحد ياخذ تقرير
                سرّي.
              </p>
              <span
                className={cn(
                  'mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold',
                  preview.mode === 'friends'
                    ? 'bg-sidi-blue/15 text-sidi-blue'
                    : 'bg-primary/15 text-primary',
                )}
              >
                {preview.mode === 'friends'
                  ? `🤝 قعدة صحاب · ${preview.players}/${preview.maxPlayers}`
                  : '💘 First Date'}
              </span>
              <div className="mt-6 space-y-4 text-start">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-semibold">
                    اسمك
                  </label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسمك ولا لقبك"
                    maxLength={24}
                    autoComplete="given-name"
                    className="h-12 rounded-xl bg-background/60 text-base"
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">إنت…</p>
                  <GenderPicker value={gender} onChange={setGender} />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    باش نكتبولك الأسئلة بالصيغة الصحيحة.
                  </p>
                </div>
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="btn-love mt-5 h-12 w-full rounded-xl text-base font-semibold"
              >
                {busy
                  ? 'لحظة…'
                  : preview.mode === 'friends'
                    ? 'ادخل للّعبة'
                    : 'ادخل للموعد'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- Chat ---------------------------------- */

function useRoomState(code: string, token: string) {
  const [state, setState] = useState<RoomState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<number>(0)
  const [offset, setOffset] = useState(0)
  const since = useRef(0)
  const first = useRef(true)
  const kick = useRef<() => void>(() => {})
  const phase = useRef<string | null>(null)

  useEffect(() => {
    let stop = false
    let timer: number | undefined
    const tick = async () => {
      window.clearTimeout(timer)
      try {
        const s = await getRoomState({
          data: { code, token, sinceEventId: since.current },
        })
        if (stop) return
        setOffset(new Date(s.serverNow).getTime() - Date.now())
        const shots = s.partnerEvents.filter((e) => e.type === 'screenshot')
        if (s.partnerEvents.length)
          since.current = Math.max(...s.partnerEvents.map((e) => e.id))
        if (shots.length) {
          setAlerts((n) => n + shots.length)
          if (!first.current) {
            for (const shot of shots) {
              const who = s.others.find((o) => o.id === shot.playerId)
              toast.error(
                `⚠️ ${who?.name ?? 'واحد'} ${who?.gender === 'female' ? 'حاولت' : 'حاول'} يصوّر الشاشة!`,
                { duration: 6000 },
              )
            }
            navigator.vibrate?.(200)
          }
        }
        first.current = false
        phase.current = s.phase
        setState(s)
        setError(null)
      } catch (err) {
        if (!stop)
          setError(err instanceof Error ? err.message : 'مشكل في الإنترنت، عاود جرّب')
      } finally {
        // Each poll is a server call: stop once the date is over, slow down while
        // waiting for the other player, and pause while the tab is hidden
        const delay =
          phase.current === 'done' ? null : phase.current === 'waiting' ? 4000 : 1500
        if (!stop && delay && !document.hidden) timer = window.setTimeout(tick, delay)
      }
    }
    const onVisible = () => {
      if (!document.hidden && phase.current !== 'done') tick()
    }
    kick.current = tick
    tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stop = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [code, token])

  const refresh = useCallback(() => kick.current(), [])
  return { state, error, alerts, offset, refresh }
}

function useCountdown(endsAt: string | null | undefined, offset: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])
  if (!endsAt) return 0
  return Math.max(
    0,
    Math.ceil((new Date(endsAt).getTime() - (now + offset)) / 1000),
  )
}

const g = (gender: string | null | undefined, male: string, female: string) =>
  gender === 'female' ? female : male

const LETTERS = ['أ', 'ب', 'ج']

function ChatRoom({ code, token }: { code: string; token: string }) {
  const navigate = useNavigate()
  const { state, error, alerts, offset, refresh } = useRoomState(code, token)
  const remaining = useCountdown(state?.phaseEndsAt, offset)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const hidden = useScreenshotGuard(true, () => {
    reportScreenshot({ data: { code, token } }).catch(() => {})
    toast.warning(
      state?.partner
        ? `📵 تصوير الشاشة ممنوع! ${state.partner.name} وصلو تنبيه.`
        : '📵 تصوير الشاشة ممنوع! صحابك وصلهم تنبيه.',
    )
  })

  const historyLen = state?.history.length ?? 0
  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [
    historyLen,
    state?.phase,
    state?.current?.index,
    state?.current?.myAnswer,
    state?.current?.answeredIds.length,
  ])

  async function send(optionIndex: number | null, text: string, voteFor: number | null = null) {
    if (!state?.current || state.current.myAnswer || sending) return
    if (!text.trim()) return
    setSending(true)
    try {
      await submitAnswer({
        data: { code, token, index: state.current.index, optionIndex, text, voteFor },
      })
      setDraft('')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'الجواب ما وصلش، عاود جرّب')
    } finally {
      setSending(false)
    }
  }

  async function joker() {
    if (!state?.current || sending) return
    setSending(true)
    try {
      await playJoker({ data: { code, token, index: state.current.index } })
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل، عاود جرّب')
    } finally {
      setSending(false)
    }
  }

  if (error && !state) {
    return (
      <div className="glow-bg grid min-h-dvh place-items-center px-5 text-center">
        <div>
          <p className="text-lg font-semibold">{error}</p>
          <Button
            className="btn-love mt-6 rounded-xl"
            onClick={() => navigate({ to: '/' })}
          >
            رجوع للصفحة الرئيسية
          </Button>
        </div>
      </div>
    )
  }
  if (!state) return <FullScreenLoader />

  const partner = state.partner
  const others = state.others
  const friends = state.mode === 'friends'
  // A friends room is shown as a group chat, except once it turns out to be just two people
  const group = friends && (others.length > 1 || state.phase === 'waiting')
  const otherById = new Map(others.map((o) => [o.id, o]))
  const onlineCount = others.filter((o) => o.online).length
  const canAnswer =
    state.phase === 'question' &&
    !!state.current &&
    !state.current.myAnswer &&
    state.current.myTurn
  // The private question the wheel gave me: answered in my own words
  const writing = canAnswer && state.current?.kind === 'spin'
  const done =
    state.phase === 'done'
      ? state.total
      : state.phase === 'waiting' || state.phase === 'intro'
        ? 0
        : state.index + (state.phase === 'reveal' ? 1 : 0)
  const sameCount = state.history.filter((h) => h.same).length
  // The finale, the votes and the wheel are shown in gold
  const special = (i: number) => state.kinds[i] !== 'question'
  const currentFinale = !!state.current && special(state.current.index)
  // A short intro before the first question of the finale, the votes and the wheel
  const introAt = (i: number) =>
    special(i) && state.kinds[i - 1] !== state.kinds[i] ? (
      <SectionIntro kind={state.kinds[i]} friends={friends} />
    ) : null
  const hasRounds = state.kinds.some((k) => k === 'vote' || k === 'spin')

  return (
    <div className="glow-bg flex h-dvh justify-center md:p-6">
      <div className="no-capture relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background/95 md:rounded-[2rem] md:border md:border-border md:shadow-2xl md:shadow-primary/10">
        {/* Header */}
        <header className="border-b border-border bg-card/80 px-3 pb-2 pt-2.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid size-9 place-items-center rounded-full text-primary hover:bg-muted"
              aria-label="رجوع"
            >
              <ArrowRight className="size-5" />
            </Link>
            {group ? (
              <GroupAvatars names={others.map((o) => o.name)} />
            ) : (
              <div className="relative">
                <div
                  className={cn(
                    'grid size-10 place-items-center rounded-full font-display font-bold text-white',
                    friends ? 'bubble-friends' : 'bg-love',
                  )}
                >
                  {partner?.name[0] ?? (friends ? '🤝' : '💘')}
                </div>
                {partner?.online && (
                  <span className="absolute -bottom-0.5 -end-0.5 size-3.5 rounded-full border-2 border-card bg-emerald-400" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                {group
                  ? others.length
                    ? others.map((o) => o.name).join('، ')
                    : 'نستنّاو صحابك…'
                  : (partner?.name ?? 'نستنّاو الشخص الآخر…')}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap text-xs">
                <span
                  className={
                    (group ? onlineCount > 0 : partner?.online)
                      ? 'text-emerald-400'
                      : 'text-muted-foreground'
                  }
                >
                  {group
                    ? others.length
                      ? `👥 ${others.length + 1} · ${onlineCount} متّصلين`
                      : `الكود ${state.code}`
                    : partner
                      ? partner.online
                        ? g(partner.gender, 'متّصل توّا', 'متّصلة توّا')
                        : g(partner.gender, 'موش متّصل', 'موش متّصلة')
                      : `الكود ${state.code}`}
                </span>
                {!group && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {friends ? '🤝 صحاب' : '💘 First Date'}
                    </span>
                  </>
                )}
              </div>
            </div>
            {sameCount > 0 && (
              <span
                className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300 tabular-nums"
                title="قدّاش من مرّة جاوبتو نفس الجواب"
              >
                ✅ {sameCount}
              </span>
            )}
            {alerts > 0 && (
              <span
                className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-1 text-xs text-destructive"
                title="محاولات تصوير الشاشة"
              >
                <ShieldAlert className="size-3.5" /> {alerts}
              </span>
            )}
            {state.phase === 'question' && (
              <TimerRing
                seconds={remaining}
                total={state.questionSeconds}
                gold={currentFinale}
              />
            )}
            {state.phase === 'spin' && (
              <TimerRing seconds={remaining} total={state.spinSeconds} gold />
            )}
          </div>
          {/* One segment per question; the finale, votes and wheel in gold */}
          <div className="mt-2 flex gap-[3px]" dir="rtl">
            {Array.from({ length: state.total }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-500',
                  i < done
                    ? special(i)
                      ? 'bg-gold'
                      : friends
                        ? 'bg-sidi-blue'
                        : 'bg-primary'
                    : i === done && ['question', 'spin', 'spinning'].includes(state.phase)
                      ? 'animate-pulse bg-muted-foreground/60'
                      : special(i)
                        ? 'bg-gold/25'
                        : 'bg-muted',
                )}
              />
            ))}
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scroller}
          className="chat-wall flex-1 space-y-2.5 overflow-y-auto px-3 py-5 md:px-5"
        >
          <SystemPill>🔒 محادثة خاصّة · تصوير الشاشة ممنوع</SystemPill>
          <BotBubble>
            {friends ? (
              <>
                أهلا {state.me.name} 🤝 {state.total} سؤال على صحبتكم. كل واحد
                يجاوب وحدو، وأجوبة صحابك يبانو كي تجاوبو الكل.{' '}
                {hasRounds ? (
                  <>
                    في الآخر{' '}
                    <span className="font-semibold text-gold">
                      {state.kinds.includes('vote') ? 'تصويت 🗳️ و' : ''}العجلة 🎡
                    </span>
                    ، وتقرير سرّي ليك إنت برك 🤫
                  </>
                ) : (
                  <>
                    آخر 5{' '}
                    <span className="font-semibold text-gold">صراحة كاملة 🔥</span>،
                    وفي الآخر تقرير سرّي ليك إنت برك 🤫
                  </>
                )}
              </>
            ) : (
              <>
                أهلا {state.me.name} 💘 {state.total} سؤال. كل واحد يجاوب وحدو،
                وجواب الآخر يبان كي تجاوبو الزوز. آخر 5{' '}
                <span className="font-semibold text-gold">على الزواج 💍</span>،
                وفي الآخر تقرير سرّي ليك إنت برك 🤫
              </>
            )}
          </BotBubble>

          {state.phase === 'waiting' && (
            <InviteCard code={state.code} friends={friends} />
          )}
          {others.map((o) => (
            <SystemPill key={o.id}>
              🎉 {o.name} {g(o.gender, 'دخل', 'دخلت')} للّعبة
            </SystemPill>
          ))}
          {state.phase === 'waiting' && friends && (
            <Lobby state={state} code={code} token={token} onStarted={refresh} />
          )}
          {state.phase === 'intro' && (
            <BotBubble>
              {group ? 'القروب حاضر!' : 'الزوز هنا!'} نبداو بعد{' '}
              <strong className="text-primary">{remaining}</strong> ⏳
            </BotBubble>
          )}

          {state.history.map((h) => (
            <div key={h.index} className="space-y-1.5">
              {introAt(h.index)}
              <QuestionBubble
                category={h.category}
                index={h.index}
                total={state.total}
                text={h.kind === 'spin' && h.chosen ? `${h.chosen.name}، ${h.text}` : h.text}
                finale={special(h.index)}
              />
              {h.kind === 'vote' ? (
                <>
                  <MyBubble friends={friends} finale>
                    {h.mine ? `🗳️ ${h.mine}` : <em className="opacity-80">⏱ ما لحقتش تصوّت</em>}
                  </MyBubble>
                  <SystemPill>
                    🗳️ صوّتو {h.voters} من {others.length + 1} · النتيجة في التقرير السرّي 🤫
                  </SystemPill>
                </>
              ) : h.kind === 'spin' ? (
                <>
                  {h.joker && <JokerPill chosen={h.chosen} me={state.me.id} />}
                  {h.chosen?.id === state.me.id ? (
                    <MyBubble friends={friends} finale>
                      {h.mine ?? <em className="opacity-80">⏱ ما لحقتش</em>}
                    </MyBubble>
                  ) : (
                    <TheirBubble name={h.chosen?.name} showName={group}>
                      <span className="flex items-center gap-1.5 text-sm opacity-80">
                        <Lock className="size-3.5" />
                        {h.answered
                          ? `${g(h.chosen?.gender, 'جاوب', 'جاوبت')} · الجواب في التقرير السرّي`
                          : `⏱ ${g(h.chosen?.gender, 'ما لحقش', 'ما لحقتش')}`}
                      </span>
                    </TheirBubble>
                  )}
                </>
              ) : (
                <>
                  {h.theirs.map((t) => {
                    const o = otherById.get(t.id)
                    return (
                      <TheirBubble key={t.id} name={o?.name} showName={group}>
                        {h.marriage ? (
                          <span className="flex items-center gap-1.5 text-sm opacity-80">
                            <Lock className="size-3.5" /> يبان في التقرير الأخير
                          </span>
                        ) : (
                          (t.text ?? (
                            <em className="opacity-70">
                              ⏱ {g(o?.gender, 'ما لحقش', 'ما لحقتش')}
                            </em>
                          ))
                        )}
                      </TheirBubble>
                    )
                  })}
                  <MyBubble friends={friends} finale={h.finale}>
                    {h.mine ?? <em className="opacity-80">⏱ ما لحقتش</em>}
                  </MyBubble>
                  {h.same && (
                    <SystemPill tone="match">
                      {group
                        ? `✅ نفس جوابك: ${h.sameWith.map((id) => otherById.get(id)?.name).join('، ')}`
                        : '✅ نفس الجواب'}
                    </SystemPill>
                  )}
                </>
              )}
            </div>
          ))}

          {state.wheel && (
            <div className="space-y-1.5">
              {introAt(state.wheel.index)}
              <WheelCard
                wheel={state.wheel}
                me={state.me}
                host={others.find((o) => o.host) ?? null}
                remaining={remaining}
                code={code}
                token={token}
                onSpun={refresh}
              />
            </div>
          )}

          {state.current && (
            <div className="space-y-1.5">
              {introAt(state.current.index)}
              <QuestionBubble
                category={state.current.category}
                index={state.current.index}
                total={state.total}
                text={
                  state.current.kind === 'spin' && state.current.chosen
                    ? `${state.current.chosen.name}، ${state.current.text}`
                    : state.current.text
                }
                finale={currentFinale}
                hint={
                  state.current.myAnswer
                    ? undefined
                    : state.current.kind === 'vote'
                      ? `🗳️ اختار واحد من صحابك · حتى حد ما باش يعرف شكون اخترت`
                      : state.current.kind === 'spin'
                        ? state.current.myTurn
                          ? '🎯 العجلة وقفت عليك! اكتب جوابك بيدك · يبان في التقرير السرّي برك'
                          : `🤫 ${state.current.chosen?.name ?? ''} ${g(state.current.chosen?.gender, 'يكتب', 'تكتب')} جوابو · يبان في التقرير السرّي برك`
                        : `🎯 ${state.me.name}، اختار الجواب اللي يشبهلك بالحق${
                            group
                              ? ' · صحابك يجاوبو على نفس السؤال'
                              : partner
                                ? ` · ${partner.name} ${g(partner.gender, 'يجاوب', 'تجاوب')} على نفس السؤال`
                                : ''
                          }`
                }
              />
              {state.current.joker && <JokerPill chosen={state.current.chosen} me={state.me.id} />}
              {state.current.kind === 'spin' ? (
                state.current.myTurn ? (
                  state.current.jokerLeft &&
                  !state.current.myAnswer && (
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        disabled={sending}
                        onClick={joker}
                        className="pop-in rounded-full border border-gold/50 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20 active:scale-95 disabled:opacity-50"
                      >
                        🃏 جوكر: بدّل السؤال (مرّة وحدة)
                      </button>
                    </div>
                  )
                ) : (
                  <TypingBubble />
                )
              ) : group ? (
                <>
                  <AnsweredRow others={others} answeredIds={state.current.answeredIds} />
                  {state.current.answeredIds.length < others.length && <TypingBubble />}
                </>
              ) : partner && state.current.answeredIds.includes(partner.id) ? (
                <TheirBubble name={partner?.name}>
                  <span className="flex items-center gap-1.5 text-sm opacity-80">
                    <Lock className="size-3.5" />{' '}
                    {g(partner?.gender, 'جاوب', 'جاوبت')}…{' '}
                    {state.current.marriage
                      ? 'يبان في التقرير الأخير'
                      : 'يبانلك كي تجاوب'}
                  </span>
                </TheirBubble>
              ) : (
                <TypingBubble />
              )}
              {state.current.myAnswer && (
                <MyBubble friends={friends} finale={currentFinale}>
                  {state.current.kind === 'vote' && '🗳️ '}
                  {state.current.myAnswer}
                  <Check className="ms-1 inline size-3.5 opacity-80" />
                </MyBubble>
              )}
            </div>
          )}

          {state.phase === 'done' && <ResultCard code={code} token={token} />}
        </div>

        {/* Composer */}
        <div
          className={cn(
            'border-t bg-card/80 backdrop-blur',
            canAnswer && currentFinale ? 'border-gold/40' : 'border-border',
          )}
        >
          {canAnswer && state.current?.kind === 'vote' && (
            <div className="flex flex-wrap justify-center gap-2 px-3 pt-3">
              {state.current.choices.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={sending}
                  onClick={() => send(null, c.name, c.id)}
                  className="pop-in flex min-h-12 items-center gap-2 rounded-2xl border border-gold/40 bg-background/60 px-4 py-2.5 text-[15px] font-semibold transition hover:border-gold hover:bg-gold/10 active:scale-[0.98] disabled:opacity-50"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="bubble-gold grid size-7 place-items-center rounded-full text-xs font-bold">
                    {c.name[0]}
                  </span>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {canAnswer && state.current?.kind === 'question' && (
            <div className="grid gap-1.5 px-3 pt-3">
              {state.current.options.map((o, i) => (
                <button
                  key={o}
                  type="button"
                  disabled={sending}
                  onClick={() => send(i, o)}
                  className={cn(
                    'pop-in flex min-h-12 items-center gap-3 rounded-2xl border bg-background/60 px-3 py-2.5 text-start text-[15px] font-medium transition active:scale-[0.98] disabled:opacity-50',
                    currentFinale
                      ? 'border-gold/40 hover:border-gold hover:bg-gold/10'
                      : friends
                        ? 'border-border hover:border-sidi-blue hover:bg-sidi-blue/10'
                        : 'border-border hover:border-primary hover:bg-primary/10',
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                      currentFinale
                        ? 'bubble-gold'
                        : friends
                          ? 'bubble-friends text-white'
                          : 'bg-love text-white',
                    )}
                  >
                    {LETTERS[i]}
                  </span>
                  {o}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-center gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              send(null, draft)
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!canAnswer || state.current?.kind === 'vote'}
              maxLength={writing ? 500 : 200}
              placeholder={
                writing
                  ? 'اكتب جوابك بصراحة… 🤫'
                  : canAnswer && state.current?.kind === 'vote'
                    ? 'اختار اسم من الفوق ☝️'
                  : canAnswer
                  ? 'ولا اكتب جوابك بيدك…'
                  : state.phase === 'done'
                    ? friends
                      ? 'القعدة كملت 🤝'
                      : 'الموعد كمل 💘'
                    : state.phase === 'waiting'
                      ? friends
                        ? 'نستنّاو اللعبة تبدا…'
                        : 'نستنّاو الشخص الآخر…'
                      : state.wheel
                        ? 'العجلة تدور… 🎡'
                      : state.current?.kind === 'spin' && !state.current.myTurn
                        ? `${state.current.chosen?.name ?? ''} ${g(state.current.chosen?.gender, 'يجاوب', 'تجاوب')}… 🤫`
                      : state.current?.myAnswer
                        ? group
                          ? 'نستنّاو البقية…'
                          : `نستنّاو ${partner?.name ?? 'الشخص الآخر'}…`
                        : 'السؤال الجاي في الطريق…'
              }
              aria-label="اكتب جوابك"
              className="h-11 flex-1 rounded-full border border-border bg-background/60 px-5 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!canAnswer || state.current?.kind === 'vote' || !draft.trim() || sending}
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-full text-white transition active:scale-90 disabled:opacity-40',
                friends ? 'bubble-friends' : 'bg-love',
              )}
              aria-label="ابعث"
            >
              <Send className="size-5 -scale-x-100" />
            </button>
          </form>
        </div>

        {hidden && (
          <div className="absolute inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-2xl">
            <div className="text-center">
              <Lock className="mx-auto size-10 text-primary" />
              <p className="mt-3 font-semibold">المحادثة مخبّية 🔒</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ارجع للصفحة باش تكمّل
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- Chat pieces ------------------------------- */

const SECTION_INTRO = {
  vote: {
    title: '🗳️ التصويت',
    line: 'كل واحد يصوّت على واحد من صحابو. شكون صوّت لشكون ما يبان لحد، والنتيجة في التقرير السرّي برك 🤫',
  },
  spin: {
    title: '🎡 العجلة',
    line: 'العجلة تدور مرّة وحدة وتختار واحد، يجاوب على زوز أسئلة خاصّين بكلامو، وعندو جوكر 🃏 يبدّل بيه سؤال مرّة وحدة. الأجوبة ما يبانو كان في التقرير السرّي 🤫',
  },
} as const

/** Shown before the first question of the finale, the votes and the wheel. */
function SectionIntro({
  kind,
  friends,
}: {
  kind: RoomState['kinds'][number]
  friends: boolean
}) {
  const intro =
    kind === 'vote' || kind === 'spin'
      ? SECTION_INTRO[kind]
      : friends
        ? { title: '🔥 آخر 5: الصراحة الكاملة', line: 'الأسئلة الأجرأ. ما تكذبش 😏' }
        : {
            title: '💍 آخر 5: الزواج',
            line: 'أسئلة الراجل موش كيف المرا، والأجوبة تبان في التقرير الأخير برك 🤫',
          }
  return (
    <div className="pt-4">
      <div className="mx-auto max-w-sm rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-center text-sm leading-relaxed">
        <div className="font-display text-base font-semibold text-gold">{intro.title}</div>
        <div className="mt-1 text-muted-foreground">{intro.line}</div>
      </div>
    </div>
  )
}

function JokerPill({
  chosen,
  me,
}: {
  chosen: { id: number; name: string; gender: string | null } | null
  me: number
}) {
  return (
    <SystemPill>
      🃏{' '}
      {chosen?.id === me
        ? 'استعملت الجوكر وبدّلت السؤال'
        : `${chosen?.name ?? ''} ${g(chosen?.gender, 'استعمل', 'استعملت')} الجوكر و${g(chosen?.gender, 'بدّل', 'بدّلت')} السؤال`}
    </SystemPill>
  )
}

function SystemPill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: 'match'
}) {
  return (
    <div
      className={cn(
        'pop-in mx-auto w-fit rounded-full px-3 py-1 text-center text-xs',
        tone === 'match'
          ? 'bg-emerald-500/15 text-emerald-300'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </div>
  )
}

function Avatar({ label, love }: { label: string; love?: boolean }) {
  return (
    <div
      className={cn(
        'grid size-7 shrink-0 place-items-center self-end rounded-full text-xs font-bold',
        love ? 'bg-love text-white' : 'bg-secondary',
      )}
    >
      {label}
    </div>
  )
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="pop-in flex items-end gap-2">
      <Avatar label="💘" love />
      <div className="max-w-[80%] rounded-3xl rounded-es-md bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
        {children}
      </div>
    </div>
  )
}

function QuestionBubble({
  category,
  index,
  total,
  text,
  finale,
  hint,
}: {
  category: string
  index: number
  total: number
  text: string
  finale?: boolean
  hint?: string
}) {
  return (
    <div className="pop-in pt-4">
      <div
        className={cn(
          'mx-auto max-w-[92%] overflow-hidden rounded-3xl border text-center shadow-lg',
          finale
            ? 'border-gold/50 bg-gradient-to-b from-gold/20 to-card shadow-gold/10'
            : 'border-border bg-gradient-to-b from-secondary to-card shadow-black/30',
        )}
      >
        <div className="flex items-center justify-between gap-4 px-4 pt-3 text-xs text-muted-foreground">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 font-medium',
              finale ? 'bg-gold/20 text-gold' : 'bg-background/50 text-foreground/80',
            )}
          >
            {finale ? `⭐ ${category}` : category}
          </span>
          <span className="tabular-nums">
            {index + 1}/{total}
          </span>
        </div>
        <div className="px-5 pb-4 pt-2.5 font-display text-lg font-semibold leading-relaxed md:text-xl">
          {text}
        </div>
        {hint && (
          <div className="-mt-2 px-5 pb-3 text-xs leading-relaxed text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
    </div>
  )
}

function TheirBubble({
  children,
  name,
  showName,
}: {
  children: React.ReactNode
  name?: string
  // In a group, each bubble says who wrote it
  showName?: boolean
}) {
  return (
    <div className="pop-in flex items-end gap-2">
      <Avatar label={name?.[0] ?? '?'} />
      <div className="max-w-[75%] rounded-3xl rounded-es-md bg-secondary px-4 py-2.5">
        {showName && name && (
          <div className="mb-0.5 text-xs font-semibold text-sidi-blue">{name}</div>
        )}
        {children}
      </div>
    </div>
  )
}

function GroupAvatars({ names }: { names: string[] }) {
  if (names.length === 0) {
    return (
      <div className="bubble-friends grid size-10 place-items-center rounded-full text-white">🤝</div>
    )
  }
  return (
    <div className="flex -space-x-3 rtl:space-x-reverse">
      {names.slice(0, 3).map((n, i) => (
        <div
          key={i}
          className="bubble-friends grid size-9 place-items-center rounded-full border-2 border-card font-display text-sm font-bold text-white"
        >
          {n[0]}
        </div>
      ))}
      {names.length > 3 && (
        <div className="grid size-9 place-items-center rounded-full border-2 border-card bg-secondary text-xs font-bold">
          +{names.length - 3}
        </div>
      )}
    </div>
  )
}

/** During a question in a group: who already answered (never what). */
function AnsweredRow({
  others,
  answeredIds,
}: {
  others: RoomState['others']
  answeredIds: number[]
}) {
  return (
    <div className="pop-in flex flex-wrap justify-center gap-1.5 py-1">
      {others.map((o) => {
        const done = answeredIds.includes(o.id)
        return (
          <span
            key={o.id}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs',
              done ? 'bg-sidi-blue/15 text-sidi-blue' : 'bg-muted text-muted-foreground',
            )}
          >
            {done ? <Lock className="size-3" /> : '…'} {o.name}
          </span>
        )
      })}
    </div>
  )
}

/** Friends room before it starts: who is in, and the host's start button. */
function Lobby({
  state,
  code,
  token,
  onStarted,
}: {
  state: RoomState
  code: string
  token: string
  onStarted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const isHost = state.me.role === 'host'
  const host = state.others.find((o) => o.host)
  const count = state.others.length + 1

  async function start() {
    setBusy(true)
    try {
      await startRoom({ data: { code, token, seen: getSeenQuestions() } })
      onStarted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل، عاود جرّب')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="surface pop-in mx-auto max-w-sm rounded-3xl p-5 text-center">
      <p className="font-display font-semibold">
        القروب · {count}/{state.maxPlayers}
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {[{ id: state.me.id, name: state.me.name, online: true }, ...state.others].map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-1.5 rounded-full border border-border bg-background/50 px-3 py-1 text-sm"
          >
            <span
              className={cn('size-2 rounded-full', p.online ? 'bg-emerald-400' : 'bg-muted-foreground/40')}
            />
            {p.id === state.me.id ? `${p.name} (إنتي)` : p.name}
          </span>
        ))}
      </div>
      {isHost ? (
        <>
          <Button
            className="bubble-friends mt-5 h-12 w-full rounded-xl text-base font-semibold text-white"
            disabled={busy || count < 2}
            onClick={start}
          >
            {busy ? 'لحظة…' : `ابدا اللعبة (${count})`}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {count < 2
              ? 'استنّى صاحب واحد على الأقل يدخل.'
              : 'كي تبدا، حتى حد ما عاد ينجم يدخل.'}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          نستنّاو {host?.name ?? 'اللي حلّ اللعبة'} {g(host?.gender, 'يبدا', 'تبدا')} اللعبة ⏳
        </p>
      )}
    </div>
  )
}

// Wheel colours, in turn: Sidi Bou Said blue, wedding gold, Tunisian red
const WHEEL_FILL = ['var(--sidi-blue)', 'var(--gold)', 'oklch(0.67 0.2 12)']
const WHEEL_INK = ['white', 'oklch(0.25 0.04 260)', 'white']

/**
 * The wheel on a spin question, with everyone's name on it. The host turns it (or it turns by
 * itself when the time runs out); the server picks who it lands on and every screen spins to them.
 */
function WheelCard({
  wheel,
  me,
  host,
  remaining,
  code,
  token,
  onSpun,
}: {
  wheel: NonNullable<RoomState['wheel']>
  me: RoomState['me']
  host: RoomState['others'][number] | null
  remaining: number
  code: string
  token: string
  onSpun: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [turn, setTurn] = useState(0)
  const [landed, setLanded] = useState(false)
  const n = wheel.players.length
  const seg = 360 / n
  const chosenAt = wheel.chosen ? wheel.players.findIndex((p) => p.id === wheel.chosen!.id) : -1
  // Five full turns, then the chosen name stops under the pointer
  const target = chosenAt >= 0 ? 360 * 5 - (chosenAt + 0.5) * seg : 0

  useEffect(() => {
    if (!target) return
    const id = requestAnimationFrame(() => setTurn(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  async function turnIt() {
    setBusy(true)
    try {
      await spin({ data: { code, token } })
      onSpun()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل، عاود جرّب')
    } finally {
      setBusy(false)
    }
  }

  const size = 240
  const c = size / 2
  const r = c - 6
  const at = (deg: number, radius: number) => {
    const a = (deg * Math.PI) / 180
    return [c + radius * Math.sin(a), c - radius * Math.cos(a)] as const
  }
  // Two neighbours never share a colour, including the last and the first
  const color = (k: number) => (k === n - 1 && n % 3 === 1 ? 1 : k % 3)

  return (
    <div className="surface pop-in mx-auto max-w-sm rounded-3xl p-5 text-center">
      <div className="relative mx-auto w-fit">
        {/* Pointer */}
        <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 border-x-[10px] border-t-[16px] border-x-transparent border-t-foreground drop-shadow" />
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{
            transform: `rotate(${turn}deg)`,
            transition: 'transform 4.5s cubic-bezier(0.15, 0.85, 0.2, 1)',
          }}
          onTransitionEnd={() => setLanded(true)}
          aria-label="العجلة"
        >
          {wheel.players.map((p, k) => {
            const [x1, y1] = at(k * seg, r)
            const [x2, y2] = at((k + 1) * seg, r)
            const [tx, ty] = at((k + 0.5) * seg, r * 0.62)
            return (
              <g key={p.id}>
                <path
                  d={`M${c},${c} L${x1},${y1} A${r},${r} 0 ${seg > 180 ? 1 : 0} 1 ${x2},${y2} Z`}
                  fill={WHEEL_FILL[color(k)]}
                  stroke="var(--card)"
                  strokeWidth="2"
                />
                <text
                  x={tx}
                  y={ty}
                  fill={WHEEL_INK[color(k)]}
                  fontSize={n > 5 ? 12 : 14}
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${(k + 0.5) * seg} ${tx} ${ty})`}
                >
                  {p.name.length > 10 ? `${p.name.slice(0, 9)}…` : p.name}
                </text>
              </g>
            )
          })}
          <circle cx={c} cy={c} r="16" fill="var(--card)" stroke="var(--gold)" strokeWidth="3" />
        </svg>
      </div>

      {wheel.spinning ? (
        <p className="mt-4 min-h-6 font-display text-lg font-semibold">
          {landed && wheel.chosen
            ? wheel.chosen.id === me.id
              ? '🎯 العجلة وقفت عليك!'
              : `🎯 العجلة وقفت على ${wheel.chosen.name}`
            : 'تدور… 🎡'}
        </p>
      ) : me.role === 'host' ? (
        <>
          <Button
            className="bubble-gold mt-4 h-12 w-full rounded-xl text-base font-semibold"
            disabled={busy}
            onClick={turnIt}
          >
            {busy ? 'لحظة…' : 'دوّر العجلة 🎡'}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            كان ما دوّرتهاش، تدور وحدها بعد {remaining} ثانية
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          نستنّاو {host?.name ?? 'اللي حلّ اللعبة'} {g(host?.gender, 'يدوّر', 'تدوّر')} العجلة ⏳ ({remaining})
        </p>
      )}
    </div>
  )
}

function MyBubble({
  children,
  friends,
  finale,
}: {
  children: React.ReactNode
  friends?: boolean
  finale?: boolean
}) {
  return (
    <div className="pop-in flex justify-end">
      <div
        className={cn(
          'max-w-[75%] rounded-3xl rounded-ee-md px-4 py-2.5',
          finale
            ? 'bubble-gold font-medium'
            : friends
              ? 'bubble-friends text-white'
              : 'bubble-mine text-white',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <Avatar label="…" />
      <div className="flex gap-1 rounded-3xl rounded-es-md bg-secondary px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot size-2 rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function TimerRing({
  seconds,
  total,
  gold,
}: {
  seconds: number
  total: number
  gold?: boolean
}) {
  const r = 17
  const c = 2 * Math.PI * r
  const urgent = seconds <= 10
  return (
    <div
      className="relative grid size-11 place-items-center"
      aria-label={`${seconds} ثانية`}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={
            urgent ? 'var(--destructive)' : gold ? 'var(--gold)' : 'var(--primary)'
          }
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - seconds / total)}
          className="transition-all duration-300"
        />
      </svg>
      <span
        className={cn(
          'text-sm font-bold tabular-nums',
          urgent && 'animate-pulse text-destructive',
        )}
      >
        {seconds}
      </span>
    </div>
  )
}

function InviteCard({ code, friends }: { code: string; friends: boolean }) {
  const [copied, setCopied] = useState(false)
  const link =
    typeof window !== 'undefined'
      ? `${window.location.origin}/room/${code}`
      : ''
  const message = friends
    ? `تعال نشوفو قدّاش نعرفو بعضنا 🤝🇹🇳\nالكود: ${code}\n${link}`
    : `تعال لموعدنا الأوّل على First Date على الطريقة التونسية 🇹🇳💍\nالكود: ${code}\n${link}`

  function copy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      toast.success('تنسخ الرابط، ابعثو للشخص الآخر')
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  async function share() {
    if (navigator.share) {
      await navigator
        .share({ title: 'First Date', text: message })
        .catch(() => {})
    } else {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        '_blank',
      )
    }
  }

  return (
    <div className="surface pop-in mx-auto max-w-sm rounded-3xl p-5 text-center">
      <p className="font-display font-semibold">
        {friends ? 'ابعث الدعوة لصحابك' : 'ابعث الدعوة للشخص الآخر'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {friends
          ? 'حتى 7 في القروب. يدخلو بالرابط، ولا يكتبو الكود هذا في الصفحة الرئيسية'
          : 'يدخل بالرابط، ولا يكتب الكود هذا في الصفحة الرئيسية'}
      </p>
      <div
        dir="ltr"
        className="text-love mt-3 font-mono text-4xl font-bold tracking-[0.3em]"
      >
        {code}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="rounded-xl" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{' '}
          انسخ الرابط
        </Button>
        <Button className="btn-love rounded-xl" onClick={share}>
          <Share2 className="size-4" /> ابعث الدعوة
        </Button>
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="typing-dot size-1.5 rounded-full bg-primary"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        {friends ? 'نستنّاو صحابك يدخلو…' : 'نستنّاو فيه يدخل…'}
      </div>
    </div>
  )
}

/* --------------------------------- Result --------------------------------- */

function ResultCard({ code, token }: { code: string; token: string }) {
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyResult({ data: { code, token } })
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : 'مشكل'))
  }, [code, token])

  if (error) return <SystemPill>{error}</SystemPill>
  if (!result) {
    return (
      <BotBubble>
        كمّلنا! نحضّرلك التقرير السرّي… <TypingInline />
      </BotBubble>
    )
  }

  if (result.kind === 'group') return <GroupResult result={result} />

  const friends = result.mode === 'friends'
  const name = result.partnerName
  const pg = result.partnerGender
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="space-y-3 pt-4">
      <BotBubble>
        كمّلنا 🎉 هذا التقرير متاعك على {name}، تشوفو إنت برك 🤫
      </BotBubble>
      <div className="surface pop-in mx-auto max-w-md overflow-hidden rounded-3xl">
        {/* Score */}
        <div
          className={cn(
            'relative px-6 pb-6 pt-7 text-center text-white',
            friends ? 'bubble-friends' : 'bg-love',
          )}
        >
          <div className="absolute start-4 top-4 flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[11px]">
            <Lock className="size-3" /> سرّي
          </div>
          <p className="text-sm opacity-90">
            {friends ? 'قدّاش صحبتكم صحيحة' : 'التفاهم مع'} {friends ? '' : name}
          </p>
          <div className="relative mx-auto mt-3 size-32">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke="rgb(255 255 255 / 0.25)"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - result.score / 100)}
                style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center font-display text-4xl font-bold">
              {result.score}%
            </div>
          </div>
          <p className="mt-3 text-lg font-semibold">
            {result.verdictEmoji} {result.verdict}
          </p>
          <div className="mx-auto mt-4 w-fit rounded-2xl bg-black/20 px-4 py-2 text-sm">
            <span className="opacity-80">{name} في كلمتين: </span>
            <strong>{result.headline}</strong>
          </div>
        </div>

        <div className="space-y-6 p-5">
          {/* Portrait */}
          {result.traits.length > 0 && (
            <section>
              <SectionTitle>
                شكون {name}؟
              </SectionTitle>
              <ul className="mt-3 space-y-3">
                {result.traits.map((t) => (
                  <li key={t.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {t.pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          friends ? 'bubble-friends' : 'bg-love',
                        )}
                        style={{ width: `${Math.min(100, t.pct * 2)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.line}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.tips.length > 0 && (
            <section className="rounded-2xl bg-muted/60 p-4">
              <SectionTitle>
                💡 كيفاش تتعامل {g(pg, 'معاه', 'معاها')}
              </SectionTitle>
              <ul className="mt-2 space-y-1.5 text-sm">
                {result.tips.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="text-primary">←</span> {t}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Topic by topic */}
          {result.topics.length > 0 && (
            <section>
              <SectionTitle>📊 موضوع بموضوع</SectionTitle>
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {result.topics.map((t) => (
                  <li
                    key={t.cat}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 font-medium">{t.label}</span>
                    {t.partnerTrait && (
                      <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                        {name}: {t.partnerTrait}
                      </span>
                    )}
                    <span className="flex gap-0.5" aria-label={`${t.same} من ${t.together}`}>
                      {Array.from({ length: t.together }, (_, i) => (
                        <span
                          key={i}
                          className={cn(
                            'size-2.5 rounded-full',
                            i < t.same ? 'bg-emerald-400' : 'bg-muted',
                          )}
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">
                🟢 = نفس الجواب
              </p>
            </section>
          )}

          {result.warnings.length > 0 && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <h3 className="font-semibold text-amber-300">⚠️ ردّ بالك</h3>
              <ul className="mt-2 space-y-1 text-amber-100/90">
                {result.warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            </section>
          )}

          {result.matches.length > 0 && (
            <section>
              <SectionTitle>💞 تلاقيتو في</SectionTitle>
              <ul className="mt-2 space-y-2">
                {result.matches.map((m) => (
                  <li
                    key={m.question}
                    className="rounded-2xl bg-emerald-500/10 px-4 py-2.5 text-sm"
                  >
                    <div className="text-muted-foreground">{m.question}</div>
                    <div className="mt-0.5 font-semibold">{m.answer}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.differences.length > 0 && (
            <section>
              <SectionTitle>🤔 ما تلاقيتوش في</SectionTitle>
              <ul className="mt-2 space-y-2">
                {result.differences.map((d) => (
                  <AnswerPair
                    key={d.question}
                    question={d.question}
                    mine={d.mine}
                    theirs={d.theirs}
                    name={name}
                  />
                ))}
              </ul>
            </section>
          )}

          {result.finale.length > 0 && (
            <section className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
              <h3 className="font-display text-lg font-semibold text-gold">
                🔥 الصراحة الكاملة
              </h3>
              <ul className="mt-3 space-y-2">
                {result.finale.map((f) => (
                  <AnswerPair
                    key={f.question}
                    question={f.question}
                    mine={f.mine ?? '⏱'}
                    theirs={f.theirs ?? '⏱'}
                    name={name}
                    gold
                  />
                ))}
              </ul>
            </section>
          )}

          <RoundsSection votes={result.votes} spins={result.spins} />

          {result.marriage && <MarriageSection report={result.marriage} />}

          <p className="text-center text-xs text-muted-foreground">
            🤫 التقرير هذا ليك برك. {name} {g(pg, 'عندو', 'عندها')} تقرير آخر
            عليك.
          </p>
          <Button
            asChild
            className={cn(
              'h-11 w-full rounded-xl text-white',
              friends ? 'bubble-friends' : 'bg-love',
            )}
          >
            <Link to="/">لعبة جديدة بأسئلة جديدة ✨</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

type GroupResultData = Extract<Result, { kind: 'group' }>

/** The report for a friends room of 3 or more: who is close to who, and who answered like who. */
function GroupResult({ result }: { result: GroupResultData }) {
  const twin = result.friends[0]
  const closest = result.pairs.slice(0, 3)
  const farthest = result.pairs.length > 3 ? result.pairs[result.pairs.length - 1] : null
  return (
    <div className="space-y-3 pt-4">
      <BotBubble>
        كمّلنا 🎉 هذا التقرير متاعك على القروب، تشوفو إنت برك 🤫
      </BotBubble>
      <div className="surface pop-in mx-auto max-w-md overflow-hidden rounded-3xl">
        <div className="bubble-friends relative px-6 pb-6 pt-7 text-center text-white">
          <div className="absolute start-4 top-4 flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[11px]">
            <Lock className="size-3" /> سرّي
          </div>
          <p className="text-sm opacity-90">توأمك في القروب</p>
          <p className="mt-2 font-display text-3xl font-bold">{twin.name}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{twin.score}%</p>
          <p className="mt-2 text-sm opacity-90">
            جاوبتو نفس الجواب {twin.same} مرّة من {twin.together}
          </p>
        </div>

        <div className="space-y-6 p-5">
          <section>
            <SectionTitle>💙 إنتي وصحابك</SectionTitle>
            <ul className="mt-3 space-y-3">
              {result.friends.map((f, i) => (
                <li key={i}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{f.name}</span>
                    <span className="tabular-nums text-muted-foreground">{f.score}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="bubble-friends h-full rounded-full" style={{ width: `${f.score}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.same} نفس الجواب من {f.together}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionTitle>🔗 شكون قريب من شكون</SectionTitle>
            <ul className="mt-3 space-y-2">
              {closest.map((p, i) => (
                <PairLine key={i} a={p.a.name} b={p.b.name} score={p.score} />
              ))}
            </ul>
            {farthest && (
              <>
                <p className="mt-4 text-xs text-muted-foreground">والأبعد على بعضهم 😅</p>
                <ul className="mt-2">
                  <PairLine a={farthest.a.name} b={farthest.b.name} score={farthest.score} far />
                </ul>
              </>
            )}
          </section>

          {result.titles.length > 0 && (
            <section className="rounded-2xl bg-muted/60 p-4">
              <SectionTitle>🏆 ألقاب القروب</SectionTitle>
              <ul className="mt-2 space-y-1.5 text-sm">
                {result.titles.map((t, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-muted-foreground">{t.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.splits.length > 0 && (
            <section>
              <SectionTitle>👥 شكون اختار كيف شكون</SectionTitle>
              <ul className="mt-2 space-y-2">
                {result.splits.map((q) => (
                  <li key={q.question} className="rounded-2xl bg-muted px-4 py-3 text-sm">
                    <div className="text-muted-foreground">{q.question}</div>
                    <ul className="mt-2 space-y-1.5">
                      {q.groups.map((grp) => (
                        <li key={grp.answer} className="rounded-xl bg-background/50 px-3 py-2">
                          <div className="font-semibold">{grp.answer}</div>
                          <div className="mt-0.5 text-xs text-sidi-blue">
                            {grp.people.map((p) => p.name).join('، ')}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.agreed.length > 0 && (
            <section>
              <SectionTitle>🤝 كلكم متّفقين على</SectionTitle>
              <ul className="mt-2 space-y-2">
                {result.agreed.map((m) => (
                  <li key={m.question} className="rounded-2xl bg-emerald-500/10 px-4 py-2.5 text-sm">
                    <div className="text-muted-foreground">{m.question}</div>
                    <div className="mt-0.5 font-semibold">{m.answer}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.alone.length > 0 && (
            <section>
              <SectionTitle>🙋 هنا كنت وحدك</SectionTitle>
              <ul className="mt-2 space-y-2">
                {result.alone.map((m) => (
                  <li key={m.question} className="rounded-2xl bg-amber-500/10 px-4 py-2.5 text-sm">
                    <div className="text-muted-foreground">{m.question}</div>
                    <div className="mt-0.5 font-semibold">{m.answer}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.finale.length > 0 && (
            <section className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
              <h3 className="font-display text-lg font-semibold text-gold">🔥 الصراحة الكاملة</h3>
              <ul className="mt-3 space-y-2">
                {result.finale.map((f) => (
                  <li key={f.question} className="rounded-2xl bg-card px-4 py-2.5 text-sm">
                    <div className="text-muted-foreground">{f.question}</div>
                    <ul className="mt-1.5 space-y-1">
                      {f.answers.map((a, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="shrink-0 font-semibold text-gold">{a.name}:</span>
                          <span>{a.text ?? '⏱'}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <RoundsSection votes={result.votes} spins={result.spins} />

          <p className="text-center text-xs text-muted-foreground">
            🤫 التقرير هذا ليك برك. كل واحد في القروب عندو تقرير متاعو.
          </p>
          <Button asChild className="bubble-friends h-11 w-full rounded-xl text-white">
            <Link to="/">لعبة جديدة بأسئلة جديدة ✨</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

/** The anonymous vote counts and the answers of the players the wheel picked. */
function RoundsSection({ votes, spins }: Pick<Result, 'votes' | 'spins'>) {
  if (!votes.length && !spins.length) return null
  return (
    <>
      {votes.length > 0 && (
        <section className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
          <h3 className="font-display text-lg font-semibold text-gold">🗳️ نتيجة التصويت</h3>
          <p className="mt-1 text-xs text-muted-foreground">شكون صوّت لشكون يبقى سرّ 🤐</p>
          <ul className="mt-3 space-y-2">
            {votes.map((v) => {
              const total = v.results.reduce((n, r) => n + r.votes, 0)
              return (
                <li key={v.question} className="rounded-2xl bg-card px-4 py-3 text-sm">
                  <div className="text-muted-foreground">{v.question}</div>
                  <ul className="mt-2 space-y-1.5">
                    {v.results.map((r) => (
                      <li key={r.name}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-semibold">
                            {r.votes === v.results[0].votes && '👑 '}
                            {r.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {r.votes} {r.votes === 1 ? 'صوت' : 'أصوات'}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="bubble-gold h-full rounded-full"
                            style={{ width: `${(r.votes / total) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {spins.length > 0 && (
        <section className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
          <h3 className="font-display text-lg font-semibold text-gold">🎡 أجوبة العجلة</h3>
          <ul className="mt-3 space-y-2">
            {spins.map((sp) => (
              <li key={sp.question} className="rounded-2xl bg-card px-4 py-3 text-sm">
                <div className="font-semibold text-gold">{sp.player?.name ?? '؟'}</div>
                {sp.skipped && (
                  <div className="mt-0.5 text-xs text-muted-foreground line-through opacity-70">
                    🃏 {sp.skipped}
                  </div>
                )}
                <div className="mt-0.5 text-muted-foreground">{sp.question}</div>
                <div className="mt-1.5 rounded-xl bg-background/50 px-3 py-2">
                  {sp.answer ?? (
                    <em className="opacity-70">
                      ⏱ {g(sp.player?.gender, 'ما لحقش يجاوب', 'ما لحقتش تجاوب')}
                    </em>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function PairLine({ a, b, score, far }: { a: string; b: string; score: number; far?: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="max-w-[35%] truncate font-semibold">{a}</span>
      <span
        className={cn('h-0.5 min-w-6 flex-1 rounded-full', far ? 'bg-muted-foreground/40' : 'bg-sidi-blue')}
      />
      <span className="max-w-[35%] truncate font-semibold">{b}</span>
      <span className="w-10 shrink-0 text-end tabular-nums text-muted-foreground">{score}%</span>
    </li>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display font-semibold">{children}</h3>
}

function AnswerPair({
  question,
  mine,
  theirs,
  name,
  gold,
}: {
  question: string
  mine: string
  theirs: string
  name: string
  gold?: boolean
}) {
  return (
    <li
      className={cn(
        'rounded-2xl px-4 py-2.5 text-sm',
        gold ? 'bg-card' : 'bg-muted',
      )}
    >
      <div className="text-muted-foreground">{question}</div>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-background/50 px-2.5 py-1.5">
          <div className="text-[11px] text-muted-foreground">إنتي</div>
          {mine}
        </div>
        <div className="rounded-xl bg-background/50 px-2.5 py-1.5">
          <div className="truncate text-[11px] text-muted-foreground">
            {name}
          </div>
          {theirs}
        </div>
      </div>
    </li>
  )
}

const LEVEL_STYLE = {
  same: 'bg-emerald-500/15 text-emerald-300',
  close: 'bg-amber-500/15 text-amber-300',
  far: 'bg-destructive/15 text-destructive',
} as const

function MarriageSection({
  report,
}: {
  report: NonNullable<Extract<Result, { kind: 'pair' }>['marriage']>
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-gold/40 bg-gold/5 p-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-gold">
          💍 نظرتكم للزواج
        </h3>
        {report.harmony != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span>تقارب النظرة</span>
              <span className="font-bold tabular-nums">{report.harmony}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="bubble-gold h-full rounded-full"
                style={{ width: `${report.harmony}%` }}
              />
            </div>
          </div>
        )}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {report.harmonyLine}
        </p>
      </div>

      {report.topics.length > 0 && (
        <ul className="space-y-1.5">
          {report.topics.map((t) => (
            <li
              key={t.topic}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span>{t.topic}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-xs',
                  LEVEL_STYLE[t.level],
                )}
              >
                {t.line}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <MarriageProfileCard heading="إنتي" profile={report.me} />
        <MarriageProfileCard
          heading={report.partner.name}
          profile={report.partner}
        />
      </div>
    </section>
  )
}

function MarriageProfileCard({
  heading,
  profile,
}: {
  heading: string
  profile: NonNullable<Extract<Result, { kind: 'pair' }>['marriage']>['me']
}) {
  return (
    <details className="group rounded-2xl bg-card p-4">
      <summary className="cursor-pointer list-none">
        <div className="text-xs text-muted-foreground">{heading}</div>
        <div className="mt-0.5 font-display font-semibold text-gold">
          {profile.title}
        </div>
        <p className="mt-1 text-sm leading-relaxed">{profile.summary}</p>
        {profile.answers.length > 0 && (
          <span className="mt-2 inline-block text-xs text-primary group-open:hidden">
            شوف الأجوبة ↓
          </span>
        )}
      </summary>
      {profile.answers.length > 0 && (
        <ul className="mt-3 space-y-2">
          {profile.answers.map((a) => (
            <li key={a.topic} className="rounded-xl bg-muted px-3 py-2 text-sm">
              <div className="text-xs text-muted-foreground">{a.topic}</div>
              <div className="mt-0.5 font-semibold">{a.answer}</div>
              <div className="mt-0.5 text-muted-foreground">{a.line}</div>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

function TypingInline() {
  return (
    <span className="ms-1 inline-flex gap-1 align-middle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot size-1.5 rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}
