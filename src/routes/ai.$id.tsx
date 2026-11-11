import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  answerAi,
  finishAi,
  getAiReport,
  getAiSession,
  startAiSession,
} from '@/lib/ai.functions'
import {
  addSeenQuestions,
  getAiToken,
  getSeenQuestions,
  saveAiToken,
} from '@/lib/session'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/ai/$id')({
  head: () => ({
    meta: [
      { title: 'اختبار الشخصية · First Date على الطريقة التونسية' },
      // A private solo session: keep it out of search (and AdSense review)
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: AiPage,
})

type Session = Awaited<ReturnType<typeof getAiSession>>
type Report = Awaited<ReturnType<typeof getAiReport>>

const noSubscribe = () => () => {}

const g = (gender: string | null | undefined, m: string, f: string) =>
  gender === 'female' ? f : m

// What the AI says between questions, so it feels like a conversation (never a judgement)
const ACKS = [
  'فهمتك 👌',
  'مسجّل ✍️',
  'صراحتك تعاونّي برشا 🙏',
  'باهي، نكمّلو',
  'هاذي تقول برشا عليك 🤔',
  'مرسي، كمّل كيف ما إنت',
  'واضح. السؤال الجاي أعمق شويّة',
  'نكمّلو 👇',
]

function AiPage() {
  const { id: rawId } = Route.useParams()
  const id = Number(rawId)
  // The token lives in this browser only: undefined while rendering on the server
  const token = useSyncExternalStore(
    noSubscribe,
    () => (Number.isInteger(id) && id > 0 ? getAiToken(id) : null),
    () => undefined,
  )
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)


  useEffect(() => {
    if (!token) return
    getAiSession({ data: { id, token } })
      .then(setSession)
      .catch((e) => setError(e instanceof Error ? e.message : 'صار مشكل'))
  }, [id, token])

  if (token === null || error) {
    return (
      <Centered>
        <div className="text-5xl">🤖</div>
        <h1 className="mt-4 font-display text-2xl font-bold">
          اللعبة هاذي موش متاعك
        </h1>
        <p className="mt-2 text-muted-foreground">
          {error ?? 'التقرير يتحلّ كان من التليفون اللي لعبت بيه.'}
        </p>
        <Link
          to="/"
          className="btn-love mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-6 font-semibold"
        >
          ابدا لعبة جديدة <ArrowLeft className="size-4" />
        </Link>
      </Centered>
    )
  }
  if (!token || !session) {
    return (
      <Centered>
        <div className="animate-pulse text-5xl">🤖</div>
      </Centered>
    )
  }
  if (session.finished) {
    return <ReportView id={id} token={token} session={session} />
  }
  return (
    <ChatView
      id={id}
      token={token}
      session={session}
      onFinished={() => setSession({ ...session, finished: true })}
    />
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="glow-bg grid min-h-dvh place-items-center px-5 text-center">
      <div>{children}</div>
    </div>
  )
}

function ChatView({
  id,
  token,
  session,
  onFinished,
}: {
  id: number
  token: string
  session: Session
  onFinished: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, number>>(
    session.answers,
  )
  const [busy, setBusy] = useState(false)
  // The last question the AI finished "typing"
  const [shownIndex, setShownIndex] = useState(-2)
  const [openText, setOpenText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  const total = session.questions.length
  const current = session.questions.find((q) => answers[String(q.index)] == null)
  const answeredCount = session.questions.filter(
    (q) => answers[String(q.index)] != null,
  ).length
  const sex = session.gender

  // The AI "types" for a moment before each new question
  const currentIndex = current?.index ?? -1
  const typing = shownIndex !== currentIndex
  useEffect(() => {
    const t = setTimeout(() => setShownIndex(currentIndex), 700)
    return () => clearTimeout(t)
  }, [currentIndex])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [answeredCount, typing])

  async function pick(index: number, option: number) {
    if (busy) return
    setBusy(true)
    setAnswers((a) => ({ ...a, [String(index)]: option }))
    try {
      await answerAi({ data: { id, token, index, option } })
    } catch (e) {
      setAnswers((a) => {
        const next = { ...a }
        delete next[String(index)]
        return next
      })
      toast.error(e instanceof Error ? e.message : 'صار مشكل، عاود جرّب')
    } finally {
      setBusy(false)
    }
  }

  async function finish(withAnswer: boolean) {
    if (busy) return
    setBusy(true)
    try {
      await finishAi({
        data: { id, token, openAnswer: withAnswer ? openText : '' },
      })
      onFinished()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'صار مشكل، عاود جرّب')
      setBusy(false)
    }
  }

  return (
    <div className="glow-bg flex h-dvh justify-center md:p-6">
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background/95 md:rounded-[2rem] md:border md:border-border md:shadow-2xl md:shadow-primary/10">
        <header className="border-b border-border bg-card/80 px-3 pb-2 pt-2.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid size-9 place-items-center rounded-full text-primary hover:bg-muted"
              aria-label="رجوع"
            >
              <ArrowRight className="size-5" />
            </Link>
            <AiAvatar size="lg" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">الذكاء الاصطناعي</div>
              <div className="text-xs text-emerald-400">
                {typing && current ? 'يكتب…' : 'متّصل توّا'}
              </div>
            </div>
            <div className="text-sm font-semibold tabular-nums text-muted-foreground">
              {Math.min(answeredCount + 1, total)}/{total}
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-l from-sidi-blue to-gold transition-all"
              style={{ width: `${(answeredCount / total) * 100}%` }}
            />
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          <AiBubble>
            أهلا {session.name} 👋 أنا الذكاء الاصطناعي متاع First Date.
          </AiBubble>
          <AiBubble>
            باش نسألك {total} سؤال على روحك. ما فمّاش جواب صحيح وجواب غالط:
            اختار اللي يشبهلك بالحق، موش اللي يبان باهي. في الآخر نعطيك تقرير
            صريح: شنوّة نقاط قوّتك، ووين لازمك تخدم على روحك. 🔍
          </AiBubble>

          {session.questions.map((q, n) => {
            const pickedI = answers[String(q.index)]
            if (pickedI == null) return null
            const picked = q.options.find((o) => o.i === pickedI)
            return (
              <div key={q.index} className="space-y-2">
                <Chip>
                  {q.category} · سؤال {n + 1} من {total}
                </Chip>
                <AiBubble>{q.text}</AiBubble>
                <MyBubble>{picked?.t}</MyBubble>
                {(n + 1) % 4 === 0 && n + 1 < total && (
                  <AiBubble small>{ACKS[(n * 7 + id) % ACKS.length]}</AiBubble>
                )}
              </div>
            )
          })}

          {current && (
            <div className="space-y-2">
              <Chip>
                {current.category} · سؤال {answeredCount + 1} من {total}
              </Chip>
              {typing ? <TypingBubble /> : <AiBubble>{current.text}</AiBubble>}
            </div>
          )}

          {!current && (
            <div className="space-y-2">
              <AiBubble>
                {g(sex, 'برافو، كمّلت', 'برافو، كمّلتي')} الأسئلة الكل 👏
              </AiBubble>
              <AiBubble>
                {session.open ??
                  'قبل التقرير: تحب تزيد تقول حاجة على روحك؟'}
                <span className="mt-1 block text-xs text-muted-foreground">
                  اكتب بكلامك، ولا فوّت. الجواب هذا يقراه الذكاء الاصطناعي برك.
                </span>
              </AiBubble>
            </div>
          )}
          <div ref={bottom} />
        </div>

        <div className="border-t border-border bg-card/80 p-3 backdrop-blur">
          {current ? (
            <div
              className={cn(
                'grid gap-2 transition',
                typing && 'pointer-events-none opacity-40',
              )}
            >
              {current.options.map((o) => (
                <button
                  key={o.i}
                  type="button"
                  disabled={busy || typing}
                  onClick={() => pick(current.index, o.i)}
                  className="rounded-2xl border border-sidi-blue/50 bg-background/60 px-4 py-3 text-start text-[15px] leading-snug transition hover:border-sidi-blue hover:bg-sidi-blue/10 disabled:opacity-60"
                >
                  {o.t}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={openText}
                onChange={(e) => setOpenText(e.target.value)}
                maxLength={1000}
                placeholder="اكتب هوني…"
                className="max-h-40 rounded-2xl bg-background/60 text-base"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={busy || !openText.trim()}
                  onClick={() => finish(true)}
                  className="btn-love h-11 flex-1 rounded-xl font-semibold"
                >
                  ابعث وشوف التقرير <Sparkles className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => finish(false)}
                  className="h-11 rounded-xl"
                >
                  فوّت
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AiAvatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-sidi-blue to-gold text-white',
        size === 'lg' ? 'size-10' : 'size-7',
      )}
    >
      <Bot className={size === 'lg' ? 'size-5' : 'size-4'} />
    </div>
  )
}

function AiBubble({
  children,
  small,
}: {
  children: React.ReactNode
  small?: boolean
}) {
  return (
    <div className="pop-in flex items-end gap-2">
      <AiAvatar />
      <div
        className={cn(
          'max-w-[80%] rounded-3xl rounded-es-md bg-secondary px-4 py-2.5 leading-relaxed',
          small && 'text-sm text-muted-foreground',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function MyBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="pop-in flex justify-end">
      <div className="bubble-mine max-w-[75%] rounded-3xl rounded-ee-md px-4 py-2.5 text-white">
        {children}
      </div>
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <AiAvatar />
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
      {children}
    </div>
  )
}

// ——— The report ———

function ReportView({
  id,
  token,
  session,
}: {
  id: number
  token: string
  session: Session
}) {
  const navigate = useNavigate()
  const [report, setReport] = useState<Report | null>(null)
  const [again, setAgain] = useState(false)

  useEffect(() => {
    getAiReport({ data: { id, token } })
      .then(setReport)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'صار مشكل'))
  }, [id, token])

  async function playAgain() {
    if (!session.gender) return navigate({ to: '/' })
    setAgain(true)
    try {
      const res = await startAiSession({
        data: {
          name: session.name,
          gender: session.gender,
          seen: getSeenQuestions(),
        },
      })
      addSeenQuestions(res.questionIds)
      saveAiToken(res.id, res.token)
      await navigate({ to: '/ai/$id', params: { id: String(res.id) } })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'صار مشكل، عاود جرّب')
      setAgain(false)
    }
  }

  if (!report) {
    return (
      <Centered>
        <div className="animate-pulse text-5xl">🤖</div>
        <p className="mt-3 text-muted-foreground">نحضّر في التقرير متاعك…</p>
      </Centered>
    )
  }

  const sex = session.gender
  return (
    <div className="glow-bg min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="size-4" /> الصفحة الرئيسية
          </Link>
          <span className="eyebrow">التقرير السرّي متاعك</span>
        </div>

        {/* Summary */}
        <section className="surface relative overflow-hidden rounded-3xl p-6 text-center">
          <div className="pointer-events-none absolute inset-x-0 -top-20 mx-auto size-56 rounded-full bg-sidi-blue/25 blur-3xl" />
          <AiAvatar size="lg" />
          <p className="mt-3 text-sm text-muted-foreground">{report.name}، إنت…</p>
          <h1 className="mt-1 font-display text-3xl font-bold">{report.title}</h1>
          <BalanceRing value={report.balance} />
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            التوازن متاع شخصيتك على 8 مواضيع. 100% معناها كل أجوبتك متوازنة،
            وما فمّا حد عندو 100%.
          </p>
        </section>

        <LetterCard paragraphs={report.letter} />

        {/* Every dimension */}
        <section className="surface rounded-3xl p-5">
          <h2 className="font-display text-xl font-bold">شخصيتك في 8 مواضيع</h2>
          <ul className="mt-4 space-y-3.5">
            {report.dims.map((d) => (
              <li key={d.dim}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold">
                    {d.emoji} {d.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {d.score}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      d.level === 'strong'
                        ? 'bg-emerald-400'
                        : d.level === 'ok'
                          ? 'bg-gold'
                          : 'bg-primary',
                    )}
                    style={{ width: `${Math.max(d.score, 4)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {d.level === 'strong' || !d.leanName
                    ? 'متوازن ✓'
                    : d.mixed
                      ? `أجوبتك ماشية في الزوز اتجاهات، أكثر: ${d.leanName}`
                      : `تميل لـ: ${d.leanName}`}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Strengths */}
        {report.strengths.length > 0 && (
          <section className="space-y-3">
            <SectionTitle icon={<Sparkles className="size-5" />}>
              نقاط قوّتك
            </SectionTitle>
            {report.strengths.map((s) => (
              <div
                key={s.dim}
                className="rounded-3xl border border-emerald-400/30 bg-emerald-400/5 p-5"
              >
                <div className="font-semibold">
                  {s.emoji} {s.label}
                </div>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  {s.text}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* What to work on */}
        <section className="space-y-3">
          <SectionTitle icon={<Target className="size-5" />}>
            شنوّة لازمك تخدم عليه
          </SectionTitle>
          {report.workOn.length === 0 && (
            <div className="surface rounded-3xl border border-gold/40 p-5 leading-relaxed">
              أجوبتك الكل جات متوازنة 100%. يا {g(sex, 'إنت متوازن', 'إنتي متوازنة')}{' '}
              برشا بالحق، يا {g(sex, 'جاوبت', 'جاوبتي')} باللي يبان باهي موش
              باللي يشبهلك 😉 حتى أكثر الناس توازن عندهم وين يكبرو. عاود العب
              وجاوب بقلبك، التقرير يولّي أصدق.
            </div>
          )}
          {report.workOn.map((w) => (
            <article
              key={w.dim}
              className="surface space-y-4 rounded-3xl border border-primary/30 p-5"
            >
              <div>
                <div className="text-xs text-muted-foreground">
                  {w.emoji} {w.label} · {w.score}%
                </div>
                <h3 className="mt-0.5 font-display text-xl font-bold">
                  {w.leanName}
                </h3>
              </div>
              <p className="leading-relaxed">{w.seen}</p>
              {w.otherName && (
                <p className="rounded-2xl bg-gold/10 p-3 text-sm leading-relaxed">
                  ⚠️ أجوبتك هنا ماشية في الزوز اتجاهات: مرّة «{w.leanName}»
                  ومرّة «{w.otherName}». هذا ياسر يصير: الواحد يتقلّب بين الزوز
                  حسب الموقف، والحل هو نفس الحل: تلقى الوسط.
                </p>
              )}
              {w.evidence.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold">
                    من أجوبتك:
                  </div>
                  <ul className="space-y-2">
                    {w.evidence.map((e, i) => (
                      <li
                        key={i}
                        className="rounded-2xl border border-border bg-background/50 p-3 text-sm"
                      >
                        <div className="text-muted-foreground">{e.question}</div>
                        <div className="mt-1 font-medium">
                          {g(sex, 'قلت', 'قلتي')}: «{e.answer}»
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  <TriangleAlert className="size-4 text-gold" /> علاش هذا مهمّ؟
                </div>
                <p className="leading-relaxed text-muted-foreground">{w.why}</p>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Lightbulb className="size-4 text-gold" /> شنوّة تعمل من
                  الجمعة هاذي
                </div>
                <ol className="space-y-2">
                  {w.tips.map((t, i) => (
                    <li key={i} className="flex gap-2.5 leading-relaxed">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </article>
          ))}
        </section>

        <p className="rounded-2xl border border-border p-4 text-xs leading-relaxed text-muted-foreground">
          التقرير هذا مبني على أجوبتك في اللعبة، وهو باش يعاونك تفهم روحك خير.
          موش تشخيص نفسي. كان تحسّ روحك موش لاباس برشا مدّة طويلة، احكي مع حد
          تثق فيه ولا مع مختص، هاذي قوّة موش ضعف.
        </p>

        <div className="flex flex-col gap-2 pb-6 sm:flex-row">
          <Button
            type="button"
            onClick={playAgain}
            disabled={again}
            className="btn-love h-12 flex-1 rounded-xl font-semibold"
          >
            <RotateCcw className="size-4" /> العب مرّة أخرى بأسئلة جديدة
          </Button>
          <Link
            to="/"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border font-semibold hover:bg-muted"
          >
            العب مع حد آخر 💘
          </Link>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <h2 className="flex items-center gap-2 font-display text-xl font-bold">
      <span className="text-gold">{icon}</span>
      {children}
    </h2>
  )
}

function BalanceRing({ value }: { value: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="relative mx-auto my-5 size-36">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-muted"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-gold transition-all duration-1000"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div>
          <div className="font-display text-4xl font-bold tabular-nums">
            {value}%
          </div>
          <div className="text-xs text-muted-foreground">توازن</div>
        </div>
      </div>
    </div>
  )
}

/**
 * The personal letter from the AI, written from the answers (src/lib/ai-letter.ts).
 * Paragraphs show up one by one, as if it was writing them.
 */
function LetterCard({ paragraphs }: { paragraphs: string[] }) {
  const [shown, setShown] = useState(1)
  const done = shown >= paragraphs.length

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => setShown((n) => n + 1), 900)
    return () => clearTimeout(t)
  }, [shown, done])

  return (
    <section className="surface space-y-3 rounded-3xl border border-sidi-blue/40 p-5">
      <div className="flex items-center gap-3">
        <AiAvatar size="lg" />
        <div>
          <h2 className="font-display text-xl font-bold">
            رسالة من الذكاء الاصطناعي
          </h2>
          <p className="text-xs text-muted-foreground">
            {done ? 'مكتوبة من أجوبتك إنت' : 'يكتب…'}
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {paragraphs.slice(0, shown).map((t, i) => (
          <p key={i} className="pop-in leading-loose">
            {t}
          </p>
        ))}
        {!done && (
          <div className="flex gap-1 py-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="typing-dot size-2 rounded-full bg-muted-foreground"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>
      {!done && (
        <button
          type="button"
          onClick={() => setShown(paragraphs.length)}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          ورّيني الرسالة الكل
        </button>
      )}
    </section>
  )
}
