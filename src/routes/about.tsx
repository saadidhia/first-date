import { Link, createFileRoute } from '@tanstack/react-router'

import { JsonLd, canonical } from '@/lib/site'
import { ContentShell } from '@/components/content-shell'

const title = 'شكون إحنا وكيفاش تخدم اللعبة — First Date'
const description =
  'First Date لعبة أسئلة تونسية للكوبلات والصحاب: علاش عملناها، كيفاش تخدم، وجواب على الأسئلة اللي ترجع برشا.'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
    ],
    links: [canonical('/about')],
  }),
  component: AboutPage,
})

const FAQ: { q: string; a: string }[] = [
  {
    q: 'اللعبة بفلوس؟',
    a: 'لا، اللعب مجّاني. الإعلانات هي اللي تعاونا نخلّصو السيرفر ونكمّلو نزيدو أسئلة.',
  },
  {
    q: 'لازمني نعمل حساب؟',
    a: 'لا. تكتب اسمك، تختار لعبة، وتبعث الكود للشخص الآخر. ما نطلبو لا إيميل لا نومرو.',
  },
  {
    q: 'الآخر يشوف التقرير متاعي؟',
    a: 'لا. كل لاعب يشوف التقرير اللي تحسب ليه هو برك. وجواب الآخر على أي سؤال ما يوصلكش قبل ما تجاوب إنت.',
  },
  {
    q: 'قدّاش من سؤال وقدّاش تاخذ اللعبة؟',
    a: '30 سؤال، و45 ثانية لكل سؤال. اللعبة الكاملة تاخذ تقريبًا ربع ساعة لعشرين دقيقة.',
  },
  {
    q: 'نجّم نلعب أكثر من مرّة؟',
    a: 'إيه. عندنا أكثر من 1300 سؤال، والمتصفّح يتذكّر الأسئلة اللي لعبتها باش يعطيك أسئلة جديدة في اللعبة الجاية.',
  },
  {
    q: 'المكالمة الصوتية تتسجّل؟',
    a: 'لا. الصوت يمشي مباشرة بين اللاعبين، ما يتعدّاش بالسيرفر متاعنا وما يتسجّلش. والميكرو مسكّر حتى تحلّو إنت.',
  },
  {
    q: 'نسبة التفاهم صحيحة؟',
    a: 'هي لعبة، موش اختبار علمي. تعطيك فكرة على وين تتلاقاو ووين تختلفو، والأحسن تستعملها باش تحكيو. شرحنا الحساب بالتفصيل في مقال «كيفاش نحسبو نسبة التفاهم».',
  },
]

function AboutPage() {
  return (
    <ContentShell>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQ.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
      <p className="eyebrow">شكون إحنا</p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">
        لعبة تونسية باش تحكيو على الحوايج المهمّة
      </h1>

      <div className="mt-6 space-y-4 text-lg leading-loose text-foreground/90">
        <p>
          First Date على الطريقة التونسية لعبة أسئلة بالدارجة، صنعناها في تونس.
          الفكرة جات من حاجة بسيطة: برشا كوبلات يعرفو بعضهم شهور، وحتى سنين، وما
          يحكيوش على الفلوس ولا العايلة ولا الغيرة كان بعد ما تولّي مشكلة.
        </p>
        <p>
          عوض ما تقعد تخمّم كيفاش تفتح الموضوع، اللعبة تفتحهولك: سؤال يطلع، كل
          واحد يجاوب من تليفونو في نفس الوقت، وبعد ما تجاوبو الزوز تشوفو أجوبة
          بعضكم. ضحك، ساعات شويّة حرج، وبرشا حديث.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">ثلاثة طرق تلعب بيها</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Mode
            emoji="💍"
            t="First Date"
            d="زوز يجاوبو على 30 سؤال على الفلوس، العايلة، الغيرة والحرّية، والآخر 5 أسئلة على الزواج. كل واحد ياخذ تقرير سرّي على الآخر."
          />
          <Mode
            emoji="🎲"
            t="صحاب"
            d="من 2 لـ 7 صحاب: أسئلة على المواقف والأسرار، تصويت «شكون فينا…»، وعجلة تختار شكون يجاوب على الأسئلة الخاصّة."
          />
          <Mode
            emoji="🤖"
            t="اختبار الشخصية"
            d="وحدك: 24 سؤال على طريقتك في العلاقات، وفي الآخر رسالة شخصية ونقاط قوّتك والحوايج اللي تنجّم تخدم عليها."
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">الأسئلة</h2>
        <p className="mt-3 leading-loose text-foreground/90">
          كتبنا الأسئلة بيدينا بالتونسي، على مواقف نعيشوها كل يوم: شكون يخلّص في
          القهوة، دار العايلة، التليفون، العرس والخطوبة. كل سؤال عندو ثلاثة
          أجوبة تمثّل طرق مختلفة في التفكير، موش جواب صحيح وجواب غالط. الأسئلة
          جريئة شويّة، أما ديما باحترام، ونزيدو فيها بانتظام.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold">أسئلة ترجع برشا</h2>
        <div className="mt-4 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="surface rounded-2xl p-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="surface mt-10 rounded-2xl p-5">
        <h2 className="font-display text-xl font-bold">تحب تحكي معانا؟</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          عندك فكرة سؤال، لقيت مشكلة، ولا تحب تطلب مسح معطياتك؟ ابعثلنا من صفحة{' '}
          <Link to="/sir" className="text-primary underline">
            ابعثلي رسالة
          </Link>
          ، نقراو الرسائل الكل. وتنجّم تقرا{' '}
          <Link to="/privacy" className="text-primary underline">
            سياسة الخصوصية
          </Link>{' '}
          باش تعرف شنوّة نجمعو وعلاش.
        </p>
      </section>
    </ContentShell>
  )
}

function Mode({ emoji, t, d }: { emoji: string; t: string; d: string }) {
  return (
    <div className="surface rounded-2xl p-4">
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <h3 className="mt-2 font-display text-lg font-semibold">{t}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
    </div>
  )
}
