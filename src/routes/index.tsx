import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Flame,
  Gem,
  KeyRound,
  Lock,
  MessageCircleHeart,
  ShieldAlert,
  Timer,
} from 'lucide-react'

import { GenderPicker } from '@/components/gender-picker'
import { ModePicker, type RoomMode } from '@/components/mode-picker'
import { Logo } from '@/components/logo'
import { TunisiaFlag } from '@/components/tunisia-flag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createRoom, joinRoom } from '@/lib/room.functions'
import {
  type Gender,
  addSeenQuestions,
  getSavedGender,
  getSeenQuestions,
  getSavedName,
  saveGender,
  saveName,
  saveToken,
} from '@/lib/session'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: Home,
})

const STEPS = [
  {
    t: 'ابدا لعبة وابعث الكود',
    d: 'اختار First Date ولا صحاب، وابعث الكود للشخص الآخر على واتساب ولا ميسنجر.',
  },
  {
    t: 'جاوبو في نفس الوقت',
    d: '30 سؤال و45 ثانية لكل سؤال. جواب الآخر ما يبانلك كان كي تجاوب إنت.',
  },
  {
    t: 'خوذ تقريرك السرّي',
    d: 'نسبة التفاهم، شخصية الآخر، ووين تتلاقاو ووين تختلفو. كل واحد يشوف متاعو برك.',
  },
]

const FEATURES = [
  {
    i: Flame,
    t: 'جرأة باحترام',
    d: 'فلوس، غيرة، عايلة، خيانة وحرية. أسئلة تحرج شويّة، أما بلا قلّة حياء.',
  },
  {
    i: Timer,
    t: '45 ثانية للسؤال',
    d: 'وقت قصير باش تجاوب بقلبك، موش بعد ما تحسبها.',
  },
  {
    i: MessageCircleHeart,
    t: '3 أجوبة جاهزة',
    d: 'اختار الجواب اللي يشبهلك بكليك، ولا اكتب جوابك بيدك.',
  },
  {
    i: Lock,
    t: 'تقرير سرّي',
    d: 'التقرير متاعك تشوفو إنت برك، والآخر عندو تقرير وحدو عليك.',
  },
  {
    i: Gem,
    t: 'خاتمة بالذهبي',
    d: 'آخر 5 أسئلة على الزواج، ومع الصحاب على الصراحة الكاملة.',
  },
  {
    i: ShieldAlert,
    t: 'تصوير الشاشة ممنوع',
    d: 'كان حد يحاول يصوّر الشاشة، الآخر يوصلو تنبيه في بلاصتو.',
  },
]

const TOPICS = [
  '💰 الفلوس',
  '👨‍👩‍👧 العايلة',
  '💔 الخيانة',
  '🕊️ الحرية',
  '👀 الغيرة',
  '🥊 العرك',
  '🧼 النظافة',
  '🤝 المشاركة',
  '🧠 نفسيتك',
  '💍 الزواج',
  '🤐 الأسرار',
  '😳 الإحراج',
]

const FAQ = [
  {
    q: 'لازم نعمل حساب؟',
    a: 'لا. تكتب اسمك وتبدا، وما نطلبو منك حتى إيميل ولا نومرو.',
  },
  {
    q: 'الشخص الآخر يشوف التقرير متاعي؟',
    a: 'لا. كل واحد يشوف التقرير متاعو برك. أجوبة الزواج زادة ما تبانش في المحادثة، تبان كان في التقرير.',
  },
  {
    q: 'علاش تسألوني راجل ولا مرا؟',
    a: 'باش الأسئلة تتكتب بالصيغة الصحيحة ليك وللشخص اللي قدّامك. وأسئلة الزواج تختلف بين الراجل والمرا.',
  },
  {
    q: 'نجّم نلعب برشا مرّات؟',
    a: 'إيه. فمّا أكثر من 600 سؤال، وكل لعبة تعطيك أسئلة ما شفتهاش قبل.',
  },
]

function Home() {
  return (
    <div className="glow-bg min-h-screen overflow-x-hidden">
      {/* Hero: wedding-day couple with the Tunisian flag */}
      <section className="relative isolate min-h-[36rem] overflow-hidden md:min-h-[42rem]">
        <img
          src="/wedding-hero.webp"
          alt="عروسة بروبة بيضاء وعريس نهار العرس في سيدي بوسعيد والعلم التونسي وراهم"
          className="absolute inset-0 -z-20 size-full object-cover object-[50%_35%]"
          fetchPriority="high"
        />
        <div className="hero-shade absolute inset-0 -z-10" />

        <header className="mx-auto flex max-w-content items-center justify-between px-5 py-5">
          <Logo />
          <nav className="flex items-center gap-1 text-sm">
            <a
              href="#how"
              className="hidden rounded-full px-4 py-2 text-white/80 transition hover:text-white sm:inline-block"
            >
              كيفاش نلعبو؟
            </a>
            <a
              href="#start"
              className="rounded-full border border-white/20 bg-black/30 px-4 py-2 font-medium text-white backdrop-blur transition hover:bg-black/50"
            >
              ابدا توّا
            </a>
          </nav>
        </header>

        <div className="mx-auto max-w-content px-5 pb-20 pt-14 md:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
            <TunisiaFlag className="h-3.5 w-auto" /> لعبة تونسية، بالدارجة
          </span>
          <h1 className="mt-5 max-w-2xl font-display font-bold leading-[1.05] text-white drop-shadow-lg">
            <span
              dir="ltr"
              className="block text-6xl tracking-tight md:text-8xl"
            >
              First Date
            </span>
            <span className="mt-3 block text-3xl text-gold md:text-5xl">
              على الطريقة التونسية
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85 drop-shadow md:text-xl">
            30 سؤال فيهم شويّة جرأة وبرشا صراحة. تجاوبو في نفس الوقت، وفي الآخر
            كل واحد ياخذ تقرير سرّي يقلّو شكون الشخص اللي قدّامو بالحق.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#start"
              className="btn-love inline-flex h-12 items-center gap-2 rounded-xl px-6 font-semibold"
            >
              ابدا لعبة جديدة <ArrowLeft className="size-4" />
            </a>
            <a
              href="#how"
              className="inline-flex h-12 items-center rounded-xl border border-white/20 bg-white/5 px-5 font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              كيفاش نلعبو؟
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
            {['مجّانية', 'بلا تسجيل', 'التقرير تشوفو إنت برك'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-gold" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <main className="relative mx-auto max-w-content px-5">
        <section className="-mt-10 grid items-start gap-12 pb-24 lg:grid-cols-2">
          <div id="start" className="scroll-mt-8">
            <StartCard />
          </div>
          <PhonePreview />
        </section>

        <section id="how" className="scroll-mt-8 pb-24">
          <SectionHeading
            eyebrow="ثلاثة خطوات"
            title="كيفاش نلعبو؟"
            sub="دقيقتين باش تبداو، ونص ساعة باش تعرفو بعضكم خير."
          />
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.t} className="surface relative rounded-3xl p-6">
                <div className="bg-love grid size-11 place-items-center rounded-2xl font-display text-lg font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">
                  {s.t}
                </h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {s.d}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="zellige rounded-[2rem] border border-border px-5 py-14 md:px-10">
          <SectionHeading
            eyebrow="المواضيع"
            title="على شنوّة باش تحكيو؟"
            sub="المواضيع اللي الناس تتهرّب منها في أوّل لقاء… هوني تتحكى بالقدا."
          />
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
            {TOPICS.map((t) => (
              <li
                key={t}
                className="rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-medium backdrop-blur"
              >
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="py-24">
          <SectionHeading eyebrow="علاش هي مختلفة" title="موش مجرّد أسئلة" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ i: Icon, t, d }) => (
              <div
                key={t}
                className="rounded-3xl border border-border bg-card/60 p-6 transition hover:border-primary/40 hover:bg-card"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{t}</h3>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  {d}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-reading pb-24">
          <SectionHeading eyebrow="أسئلة تتعاود" title="عندك سؤال؟" />
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-border bg-card/70 px-5 py-4 open:bg-card"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
          <div className="mt-12 text-center">
            <a
              href="#start"
              className="btn-love inline-flex h-12 items-center gap-2 rounded-xl px-7 font-semibold"
            >
              يزّي مالحكي، ابدا <ArrowLeft className="size-4" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <TunisiaFlag className="h-3.5 w-auto" />
          <span dir="ltr">First Date</span> على الطريقة التونسية · صنعت في تونس
          بالحب
        </span>
        <div className="mt-3">
          <Link
            to="/privacy"
            className="text-xs underline hover:text-foreground"
          >
            سياسة الخصوصية
          </Link>
        </div>
      </footer>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string
  title: string
  sub?: string
}) {
  return (
    <div className="text-center">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">
        {title}
      </h2>
      {sub && (
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  )
}

function StartCard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [mode, setMode] = useState<RoomMode>('date')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(getSavedName())
    setGender(getSavedGender())
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('اكتب اسمك قبل ما تبدا')
    if (!gender) return toast.error('اختار راجل ولا مرا')
    setBusy(true)
    try {
      const res =
        tab === 'create'
          ? await createRoom({
              data: {
                name,
                gender,
                mode,
                seen: getSeenQuestions(),
                ref:
                  typeof document !== 'undefined'
                    ? document.referrer
                    : undefined,
              },
            })
          : await joinRoom({ data: { name, gender, code } })
      addSeenQuestions(res.questionIds)
      saveName(name.trim())
      saveGender(gender)
      saveToken(res.code, res.token)
      await navigate({ to: '/room/$code', params: { code: res.code } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل، عاود جرّب')
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="surface max-w-md rounded-3xl p-5 backdrop-blur md:p-6"
    >
      <h2 className="font-display text-2xl font-bold">
        {tab === 'create' ? 'ابدا لعبة جديدة' : 'ادخل للعبة صاحبك'}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {tab === 'create'
          ? 'تاخذ كود، تبعثو للشخص الآخر، وتبداو.'
          : 'اكتب الكود اللي وصلك (6 حروف وأرقام).'}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        {(['create', 'join'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTab(m)}
            aria-pressed={tab === m}
            className={cn(
              'rounded-xl py-2.5 text-sm font-semibold transition',
              tab === m
                ? 'bg-background text-foreground shadow ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'create' ? 'لعبة جديدة' : 'عندي كود'}
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-4">
        {tab === 'create' && (
          <Field label="مع شكون باش تلعب؟">
            <ModePicker value={mode} onChange={setMode} />
          </Field>
        )}
        {tab === 'join' && (
          <Field label="كود اللعبة" htmlFor="code">
            <div className="relative">
              <KeyRound className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="code"
                dir="ltr"
                value={code}
                autoComplete="off"
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 6),
                  )
                }
                placeholder="ABC123"
                className="h-12 rounded-xl bg-background/60 text-center font-mono text-lg tracking-[0.4em]"
              />
            </div>
          </Field>
        )}
        <Field label="اسمك" htmlFor="name" hint="هذا اللي يشوفو الشخص الآخر.">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك ولا لقبك"
            maxLength={24}
            autoComplete="given-name"
            className="h-12 rounded-xl bg-background/60 text-base"
          />
        </Field>
        <Field label="إنت…" hint="باش نكتبولك الأسئلة بالصيغة الصحيحة.">
          <GenderPicker value={gender} onChange={setGender} />
        </Field>
        <Button
          type="submit"
          disabled={busy || (tab === 'join' && code.length !== 6)}
          className="btn-love h-12 w-full rounded-xl text-base font-semibold"
        >
          {busy
            ? 'لحظة…'
            : tab === 'create'
              ? 'ابدا وخوذ الكود'
              : 'ادخل للّعبة'}
          <ArrowLeft className="size-4" />
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function PhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="pointer-events-none absolute -inset-10 -z-0">
        {['💍', '💞', '🇹🇳', '💋', '👰'].map((h, i) => (
          <span
            key={i}
            className="heart-float absolute text-2xl"
            style={{
              left: `${10 + i * 20}%`,
              bottom: `${(i % 2) * 20}%`,
              animationDelay: `${i * 0.8}s`,
            }}
          >
            {h}
          </span>
        ))}
      </div>
      <div className="surface relative rounded-[2.5rem] p-3">
        <div className="overflow-hidden rounded-[2rem] bg-background">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="bg-love grid size-9 place-items-center rounded-full font-bold text-white">
              س
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">سارة</div>
              <div className="text-xs text-emerald-400">متّصلة توّا</div>
            </div>
            <div className="grid size-9 place-items-center rounded-full border-2 border-primary text-xs font-bold">
              32
            </div>
          </div>
          <div className="space-y-2.5 p-4 text-sm">
            <div className="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
              💰 الفلوس · سؤال 3 من 30
            </div>
            <div className="max-w-[85%] rounded-3xl rounded-ss-md bg-secondary px-4 py-2.5">
              شكون يخلّص في أوّل لقاء؟ 💸
            </div>
            <div className="max-w-[75%] rounded-3xl rounded-ss-md bg-secondary px-4 py-2.5">
              بالشطر، كل واحد يخلّص متاعو
            </div>
            <div className="bubble-mine ms-auto max-w-[75%] rounded-3xl rounded-se-md px-4 py-2.5 text-white">
              أنا، وما فيهاش نقاش 😎
            </div>
            <div className="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
              جوابين مختلفين 😅
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 px-3 pb-4">
            {['أنا نخلّص 😎', 'إنتي', 'بالشطر'].map((c) => (
              <span
                key={c}
                className="shrink-0 rounded-full border border-primary/60 px-3 py-1.5 text-xs text-primary"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
