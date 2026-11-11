import { Link, createFileRoute } from '@tanstack/react-router'

import { canonical } from '@/lib/site'
import { ContentShell } from '@/components/content-shell'

const title = 'شروط الاستعمال — First Date'
const description =
  'القواعد متاع استعمال First Date: اللعب، الاحترام بين اللاعبين، المحتوى، الإعلانات، والمسؤولية.'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
    ],
    links: [canonical('/terms')],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <ContentShell>
      <h1 className="font-display text-3xl font-bold">شروط الاستعمال</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        آخر تحديث: 9 نوفمبر 2026
      </p>

      <p className="mt-6 leading-loose text-foreground/90">
        مرحبا بيك في First Date على الطريقة التونسية. كي تستعمل الموقع، إنت
        توافق على الشروط هاذي. كان ما توافقش عليها، ما تستعملش الموقع.
      </p>

      <Section title="1. شنوّة هو First Date">
        <p>
          First Date لعبة أسئلة للتسلية بين زوز ولا مجموعة صحاب، واختبار شخصية
          تلعبو وحدك. النتائج (نسبة التفاهم، التقرير السرّي، الرسالة) محسوبة
          أوتوماتيكيًا من الأجوبة، وهي للتسلية وفتح الحديث برك. ما هيش نصيحة
          نفسية ولا طبّية ولا قانونية، وما تعوّضش مختصّ.
        </p>
      </Section>

      <Section title="2. اللعب بالاحترام">
        <ul className="list-disc space-y-1.5 pe-5">
          <li>ما تبعثش كود اللعبة لحدّ ما يحبّش يلعب، وما تلعبش بإسم شخص آخر.</li>
          <li>
            الأجوبة المكتوبة والمكالمة الصوتية: ممنوع السبّ، التهديد، التحرّش،
            ولا أي كلام عنصري ولا عنيف.
          </li>
          <li>
            ما تصوّرش الشاشة ولا تسجّل المكالمة وتنشرها بلا موافقة اللاعبين
            الآخرين. التقرير السرّي خاص بيك.
          </li>
          <li>ما تحاولش تخرّب الموقع، تتجاوز الحمايات، ولا تستعمل سكريبتات أوتوماتيكية.</li>
        </ul>
      </Section>

      <Section title="3. المحتوى">
        <p>
          الأسئلة، المقالات، التصميم والكود ملك First Date. تنجّم تشارك روابط
          الموقع وتحكي على الأسئلة مع صحابك، أما ما تنجّمش تنسخ بنك الأسئلة ولا
          المقالات وتنشرهم في بلاصة أخرى.
        </p>
        <p>
          الأجوبة اللي تكتبها تبقى متاعك. نستعملوها كان باش اللعبة تخدم وباش
          نحسبو التقرير، كيما مشروح في{' '}
          <Link to="/privacy" className="text-primary underline">
            سياسة الخصوصية
          </Link>
          .
        </p>
      </Section>

      <Section title="4. الإعلانات">
        <p>
          الموقع مجّاني، ونخلّصو مصاريفو بالإعلانات (Google AdSense). الإعلانات
          تبان في صفحات القراية، وموش في وسط اللعبة. ما نتحكّموش في محتوى
          الإعلانات، وكي تنزل على إعلان تخرج لموقع آخر عندو شروطو.
        </p>
      </Section>

      <Section title="5. المسؤولية">
        <p>
          نعملو جهدنا باش الموقع يخدم ديما، أما ما نضمنوش إنّو ما يصيرش عطل ولا
          انقطاع. ما نتحمّلوش مسؤولية القرارات اللي تاخذها على أساس نتيجة لعبة،
          ولا الكلام اللي يقولو لاعب آخر في المكالمة ولا في الأجوبة.
        </p>
      </Section>

      <Section title="6. التبديلات">
        <p>
          ننجّمو نبدّلو الشروط هاذي كي يتطوّر الموقع. التاريخ اللي الفوق يورّي
          آخر تبديل.
        </p>
      </Section>

      <Section title="7. التواصل">
        <p>
          عندك سؤال على الشروط هاذي، ولا تحب تبلّغ على استعمال غالط؟ ابعثلنا من
          صفحة{' '}
          <Link to="/sir" className="text-primary underline">
            ابعثلي رسالة
          </Link>
          .
        </p>
      </Section>
    </ContentShell>
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
    <section className="surface mt-5 rounded-2xl p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}
