import { Link, createFileRoute } from '@tanstack/react-router'

import { Logo } from '@/components/logo'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'سياسة الخصوصية — First Date' },
      {
        name: 'description',
        content: 'شنوّة المعطيات اللي نجمعوها في First Date وكيفاش نستعملوها.',
      },
    ],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <div className="glow-bg min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <Link to="/">
          <Logo />
        </Link>
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← للرئيسية
        </Link>
      </header>

      <main className="mx-auto mt-10 max-w-2xl space-y-6 pb-16">
        <div>
          <h1 className="font-display text-3xl font-bold">سياسة الخصوصية</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            آخر تحديث: 29 أكتوبر 2026
          </p>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          First Date هي لعبة بين زوز (ولا مجموعة صحاب) تلعبوها بالتونسي. هاك
          الصفحة تشرحلك شنوّة المعطيات اللي نجمعوها، علاش، وكيفاش نحافظو عليها.
        </p>

        <Section title="المعطيات اللي نجمعوها">
          <ul className="list-disc space-y-1.5 pe-5">
            <li>
              الاسم اللي تكتبو وقت تحلّ ولا تدخل لعبة، والجنس اللي تختارو.
            </li>
            <li>الإجابات متاعك على أسئلة اللعبة (باش نحسبولك التقرير).</li>
            <li>
              كي تحكي في المكالمة الصوتية، الصوت يمشي مباشرة بينك وبين اللاعبين
              الآخرين (WebRTC) وما نسجّلوهش وما نخزّنوهش عندنا.
            </li>
            <li>
              معطيات تقنية بسيطة باش اللعبة تخدم (نوع المتصفّح، وقت الدخول)،
              والرسائل اللي تبعثها عبر صفحة «ابعثلي رسالة» تبقى مجهولة.
            </li>
          </ul>
        </Section>

        <Section title="علاش نستعملو المعطيات">
          <p>
            نستعملوها كان باش اللعبة تخدم: نربطوك باللاعب الآخر، نحسبو التقرير
            السرّي، ونحسّنو الخدمة. ما نبيعوش معطياتك لحتى حد.
          </p>
        </Section>

        <Section title="الكوكيز والإعلانات">
          <p>
            نستعملو <strong>Google AdSense</strong> باش نورّيو إعلانات.
            الموفّرين الآخرين، وفيهم Google، ينجّمو يستعملو الكوكيز (cookies)
            باش يورّيو إعلانات على حسب الزيارات متاعك للموقع هذا ولمواقع أخرى.
            الكوكيز متاع الإعلانات تخلّي Google وشركاءها يورّيو إعلانات ليك
            ولمستعملين آخرين.
          </p>
          <p className="mt-2">
            تنجّم تمنع الإعلانات المخصّصة من{' '}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              إعدادات إعلانات Google
            </a>
            ، ولا تعرف أكثر على الكوكيز في الإعلانات من{' '}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              سياسة Google
            </a>
            .
          </p>
        </Section>

        <Section title="مشاركة المعطيات">
          <p>
            ما نشاركو حتى معطيات شخصية مع أطراف أخرى، كان المزوّدين التقنيين
            اللي يخدمو الموقع (كيما Google للإعلانات) ولا كي يفرضها القانون.
          </p>
        </Section>

        <Section title="حقوقك">
          <p>
            تنجّم تطلب مسح المعطيات متاعك. المعطيات متاع اللعبة تتمسح بطبيعتها
            بعد ما تكمّل اللعبة بوقت. باش تتواصل معانا في أي حاجة، عدّي عبر صفحة{' '}
            <Link to="/sir" className="text-primary underline">
              ابعثلي رسالة
            </Link>
            .
          </p>
        </Section>

        <p className="border-t border-border pt-6 text-xs text-muted-foreground">
          كي تستعمل First Date، إنت توافق على سياسة الخصوصية هذي.
        </p>
      </main>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="surface rounded-2xl p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}
