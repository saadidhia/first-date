// The public /questions pages: one page per game topic with a sample of its questions.
// Only the metadata lives here (client-safe). The questions themselves come from the bank on
// the server (`question-pages.functions.ts`), so the 1300 questions never ship to the browser.
//
// Slugs are public URLs: don't rename one that is already live.

import type { Category } from './questions'

export type QuestionTopic = {
  slug: string
  /** 'marriage' is the date finale (MARRIAGE_QUESTIONS), not a regular category */
  cat: Category | 'marriage'
  mode: 'date' | 'friends'
  emoji: string
  title: string
  intro: string
}

export const QUESTION_TOPICS: QuestionTopic[] = [
  {
    slug: 'money',
    cat: 'flous',
    mode: 'date',
    emoji: '💰',
    title: 'أسئلة على الفلوس للكوبلات',
    intro:
      'شكون يخلّص، كيفاش نقسمو المصروف، والهدايا الغالية: أسئلة تكشف علاقة كل واحد بالفلوس، وهي من أكثر المواضيع اللي تعمل خلاف بين الكوبلات كان ما تتحكاش من الأوّل.',
  },
  {
    slug: 'sharing',
    cat: 'mocharka',
    mode: 'date',
    emoji: '🤝',
    title: 'أسئلة على المشاركة وشغل الدار',
    intro:
      'الطيب، التنظيف، القضية والتليكوموند: الحياة اليومية مع بعضكم فيها برشا تفاصيل صغيرة. الأسئلة هاذي تورّي كيفاش كل واحد يشوف تقسيم المسؤوليات.',
  },
  {
    slug: 'family',
    cat: '3ayla',
    mode: 'date',
    emoji: '👨‍👩‍👧',
    title: 'أسئلة على العايلة والحماة',
    intro:
      'الزيارات، دار العايلة، الحماة والأعياد: في تونس العرس يجمع زوز عايلات. الأسئلة هاذي تساعدكم تعرفو وين يحطّ كل واحد الحدود.',
  },
  {
    slug: 'cleanliness',
    cat: 'ndhafa',
    mode: 'date',
    emoji: '🧼',
    title: 'أسئلة على النظافة والترتيب',
    intro:
      'المواعن في البالوعة، الحوايج على الكرسي، والسرير المفرود ولا لا: حوايج تبان صغيرة أما تولّي كبيرة كي تسكنو مع بعضكم.',
  },
  {
    slug: 'cheating',
    cat: 'khiyana',
    mode: 'date',
    emoji: '💔',
    title: 'أسئلة على الخيانة والثقة',
    intro:
      'وين تبدا الخيانة؟ مساج للـ ex، لايك على تصويرة، ولا كذبة صغيرة؟ كل واحد عندو حدود مختلفة، والأسئلة هاذي توضّحها.',
  },
  {
    slug: 'freedom',
    cat: '7orriya',
    mode: 'date',
    emoji: '🕊️',
    title: 'أسئلة على الحرّية والغيرة',
    intro:
      'الخرجات مع الصحاب، التليفون، والسفر وحدك: قدّاش من مساحة يحتاج كل واحد في العلاقة، وقدّاش يقبل يعطي؟',
  },
  {
    slug: 'fights',
    cat: '3ark',
    mode: 'date',
    emoji: '🥊',
    title: 'أسئلة على الخصام والصلح',
    intro:
      'شكون يتصالح الأوّل؟ تسكت ولا تحكي؟ تخرّج القديم ولا لا؟ طريقة الخصام تقول على العلاقة أكثر من الخصام في حدّ ذاتو.',
  },
  {
    slug: 'psychology',
    cat: 'nafsi',
    mode: 'date',
    emoji: '🧠',
    title: 'أسئلة نفسية باش تعرف شخصيّتو',
    intro:
      'كيفاش تتصرّف كي تتقلّق، كي تخاف، ولا كي تفرح؟ أسئلة على الطباع والإحساس، باش تعرف الشخص اللي قدّامك من الداخل.',
  },
  {
    slug: 'marriage',
    cat: 'marriage',
    mode: 'date',
    emoji: '💍',
    title: 'أسئلة على الزواج والمستقبل',
    intro:
      'آخر 5 أسئلة في كل First Date على الزواج: السكنى، الخدمة، الصغار والقرارات الكبيرة. الأجوبة مرتّبة من الشراكة الكاملة للطريقة التقليدية، والتقرير يقارن بيناتكم.',
  },
  {
    slug: 'friends-how-you-see',
    cat: 'nadhra',
    mode: 'friends',
    emoji: '👀',
    title: 'أسئلة للصحاب: كيفاش تشوف صاحبك؟',
    intro:
      'شكون فيكم الأكثر خوّاف، الأكثر رومانسي، ولا الأكثر فوضوي؟ أسئلة تورّي كيفاش يشوفك صحابك بالحق.',
  },
  {
    slug: 'friends-situations',
    cat: 'mawqef',
    mode: 'friends',
    emoji: '🎭',
    title: 'أسئلة مواقف للصحاب',
    intro:
      'صاحبك في مشكلة في نص الليل، ولا لقيت سرّو صدفة: شنوّة تعمل؟ مواقف من الحياة اليومية تختبر الصحبة.',
  },
  {
    slug: 'friends-embarrassing',
    cat: 'i7raj',
    mode: 'friends',
    emoji: '😳',
    title: 'أسئلة محرجة للصحاب',
    intro:
      'الأسئلة اللي تضحّك المجموعة الكل: مواقف محرجة، اعترافات صغيرة، وحوايج ما يعرفهاش حد. جرأة، أما بالاحترام.',
  },
  {
    slug: 'friends-money',
    cat: 'flous_s',
    mode: 'friends',
    emoji: '💸',
    title: 'أسئلة على الفلوس بين الصحاب',
    intro:
      'السلف، القهوة، والكادو المشترك: الفلوس بين الصحاب تنجّم تقرّب ولا تبعّد. شوف كيفاش يتصرّف كل واحد.',
  },
  {
    slug: 'friends-secrets',
    cat: 'sirr',
    mode: 'friends',
    emoji: '🤐',
    title: 'أسئلة على الأسرار والثقة بين الصحاب',
    intro:
      'تحكيلو كل شي؟ يحفظ السرّ؟ وكان سرّو يضرّ بحدّ آخر؟ أسئلة على الثقة اللي تبني الصحبة.',
  },
  {
    slug: 'friends-fights',
    cat: '3ark_s',
    mode: 'friends',
    emoji: '🥊',
    title: 'أسئلة على الخصام بين الصحاب',
    intro:
      'كيفاش تتخاصمو، شكون يرجع الأوّل، وشنوّة الحاجة اللي ما تتسامحش: الخصام جزء من كل صحبة طويلة.',
  },
]

export function getQuestionTopic(slug: string) {
  return QUESTION_TOPICS.find((t) => t.slug === slug)
}
