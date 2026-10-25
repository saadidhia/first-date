// Question bank in Tunisian dialect. Each option carries trait weights that feed
// the private note shown at the end. The hand-written classics live here; the big
// themed banks (date and friends) live in ./bank in a compact format.

import { AYLA, NDHAFA } from './bank/date-2'
import { ARK, NAFSI } from './bank/date-4'
import { FLOUS, MOCHARKA } from './bank/date-1'
import { HORRIYA, KHIYANA } from './bank/date-3'
import { IHRAJ, MAWQEF, NADHRA } from './bank/friends-1'
import { ARK_S, FLOUS_S, SARAHA, SIRR } from './bank/friends-2'
import { MORE_MARRIAGE } from './bank/marriage'
import type { RawQuestion } from './bank/types'

export type Trait =
  | 'romance'
  | 'adventure'
  | 'jealousy'
  | 'independence'
  | 'humor'
  | 'tradition'
  | 'calm'

export type Mode = 'date' | 'friends'

export type Category =
  // date
  | 'jor2a'
  | 'nafsi'
  | 'mawa9ef'
  | 'fadlaka'
  | '3ala9a'
  | 'zawej'
  | 'flous'
  | 'mocharka'
  | '3ayla'
  | 'ndhafa'
  | 'khiyana'
  | '7orriya'
  | '3ark'
  // friends
  | 'nadhra'
  | 'mawqef'
  | 'i7raj'
  | 'flous_s'
  | 'sirr'
  | '3ark_s'
  | 'saraha'

export type Gender = 'male' | 'female'

export type Option = { t: string; s: Partial<Record<Trait, number>> }

export type Question = {
  id: string
  cat: Category
  mode: Mode
  text: string
  options: Option[]
}

export const CATEGORY_LABEL: Record<Category, string> = {
  jor2a: '🔥 جرأة',
  nafsi: '🧠 نفسي',
  mawa9ef: '🎭 مواقف',
  fadlaka: '😂 فدلكة',
  '3ala9a': '❤️ علاقة',
  zawej: '💍 الزواج',
  flous: '💰 الفلوس',
  mocharka: '🤝 المشاركة',
  '3ayla': '👨‍👩‍👧 العايلة',
  ndhafa: '🧼 النظافة',
  khiyana: '💔 الخيانة',
  '7orriya': '🕊️ الحرية',
  '3ark': '🥊 العرك',
  nadhra: '👀 نظرتك لصاحبك',
  mawqef: '🎭 مواقف',
  i7raj: '😳 إحراج',
  flous_s: '💸 الفلوس',
  sirr: '🤐 الأسرار',
  '3ark_s': '🥊 العرك',
  saraha: '🔥 الصراحة',
}

const CLASSICS: Omit<Question, 'mode'>[] = [
  {
    id: 'pay',
    cat: 'jor2a',
    text: 'شكون يخلّص في أوّل لقاء؟ 💸',
    options: [
      { t: 'أنا نخلّص، وما فيهاش نقاش 😎', s: { tradition: 2, romance: 1 } },
      { t: 'إنتي، على خاطرك إنتي اللي عزمت', s: { tradition: 1, humor: 1 } },
      { t: 'بالشطر، كل واحد يخلّص متاعو', s: { independence: 2, calm: 1 } },
    ],
  },
  {
    id: 'vu',
    cat: '3ala9a',
    text: 'تبعث مساج لـ{شريكك}، {يعمل|تعمل} "vu" وما {يجاوبش|تجاوبش} ساعتين… شنوّة تعمل؟',
    options: [
      {
        t: 'نستنّى عادي، {عندو حياتو|عندها حياتها}',
        s: { calm: 2, independence: 1 },
      },
      { t: 'نبعث{لو|لها} "؟" وخلاص 🙂', s: { jealousy: 1, humor: 1 } },
      {
        t: 'نعمل{لو|لها} vu حتى أنا ونردّ{لو|لها} الصرف 😤',
        s: { jealousy: 2, humor: 1 },
      },
    ],
  },
  {
    id: 'friend',
    cat: 'jor2a',
    text: 'تقبل {شريكك} يكون {عندو صاحبة قريبة ليه|عندها صاحب قريب ليها} برشا؟',
    options: [
      { t: 'عادي، الثقة هي الأساس', s: { calm: 2, independence: 1 } },
      {
        t: 'عادي، أما نحب نتعرّف {عليها|عليه} زادة',
        s: { calm: 1, jealousy: 1 },
      },
      { t: 'لا، ما نقبلش بالكل', s: { jealousy: 2, tradition: 1 } },
    ],
  },
  {
    id: 'phone',
    cat: 'jor2a',
    text: 'تعطي {شريكك} التليفون متاعك مفتوح {يقلّب|تقلّب} فيه؟ 📱',
    options: [
      { t: 'إيه، ما عندي ما نخبّي', s: { romance: 1, calm: 1 } },
      { t: 'لا، الخصوصية خط أحمر', s: { independence: 2 } },
      {
        t: 'إيه، أما {يعطيني متاعو|تعطيني متاعها} زادة 😏',
        s: { jealousy: 2 },
      },
    ],
  },
  {
    id: 'kiss',
    cat: 'jor2a',
    text: 'أوّل بوسة بيناتكم، وقتاش تكون؟ 💋',
    options: [
      { t: 'في أوّل لقاء، كان الجو يسمح', s: { adventure: 2, romance: 1 } },
      { t: 'كي نحسّ بالثقة، ما عنديش وقت محدّد', s: { romance: 1, calm: 1 } },
      { t: 'بعد الخطوبة، موش قبل', s: { tradition: 2 } },
    ],
  },
  {
    id: 'notice',
    cat: 'fadlaka',
    text: 'كي تتعرّف على حد جديد، شنوّة أوّل حاجة تلفت انتباهك فيه؟ 👀',
    options: [
      { t: 'العينين، ديما نبدا بيهم', s: { romance: 2 } },
      { t: 'الضحكة، هي اللي تشدّني', s: { humor: 2 } },
      { t: 'طريقة الكلام والأسلوب', s: { calm: 2 } },
    ],
  },
  {
    id: 'ex',
    cat: 'jor2a',
    text: 'تحكي على الـ ex متاعك في أوّل لقاء؟',
    options: [
      { t: 'لا، اللي فات مات', s: { calm: 1, independence: 1 } },
      { t: 'كان {سألني|سألتني} نجاوب بالصراحة', s: { calm: 2 } },
      { t: 'نحكي ونقعد نسبّ {@فيها|فيه} 😂', s: { humor: 2, jealousy: 1 } },
    ],
  },
  {
    id: 'loved',
    cat: 'jor2a',
    text: 'قدّاش من مرّة حبّيت بالحق؟',
    options: [
      { t: 'عمري ما حبّيت بالحق', s: { independence: 2 } },
      { t: 'مرّة وحدة وبرّا', s: { romance: 2, tradition: 1 } },
      { t: 'برشا، ما عادش نحسب 😏', s: { adventure: 2, humor: 1 } },
    ],
  },
  {
    id: 'lie',
    cat: 'mawa9ef',
    text: 'لقيت {شريكك} {كذب|كذبت} عليك في حاجة صغيرة… شنوّة تعمل؟',
    options: [
      { t: 'نسامح، حاجة صغيرة', s: { calm: 2, romance: 1 } },
      { t: 'نحكي {معاه|معاها} بالصراحة', s: { calm: 1, independence: 1 } },
      { t: 'نولّي نشكّ {فيه|فيها} في كل شيء', s: { jealousy: 2 } },
    ],
  },
  {
    id: 'morning',
    cat: '3ala9a',
    text: 'شكون لازم يبعث "صباح الخير" الأوّل؟ ☀️',
    options: [
      { t: 'أنا، ديما نبدا', s: { romance: 2 } },
      { t: 'إنتي، لازم تبادر', s: { tradition: 1, jealousy: 1 } },
      { t: 'اللي يفيق الأوّل يبعث', s: { calm: 1, humor: 1 } },
    ],
  },
  {
    id: 'weekend',
    cat: 'nafsi',
    text: 'كيفاش يكون الويكاند المثالي متاعك؟',
    options: [
      { t: 'في الدار، فيلم وكوفرتة 🍿', s: { calm: 2, romance: 1 } },
      { t: 'سهرية مع الصحاب 🎉', s: { humor: 2, adventure: 1 } },
      { t: 'خرجة لبلاصة جديدة 🏕️', s: { adventure: 2 } },
    ],
  },
  {
    id: 'problem',
    cat: 'nafsi',
    text: 'كي تصير مشكلة بيناتكم، كيفاش تحب تحلّوها؟',
    options: [
      { t: 'نحلّوها توّا، ما نرقدش بيها', s: { romance: 1, jealousy: 1 } },
      { t: 'نخلّي الوقت يبرّدها', s: { calm: 2 } },
      {
        t: 'نستنّى {هو يجي يحكي|هي تجي تحكي} الأوّل',
        s: { independence: 1, tradition: 1 },
      },
    ],
  },
  {
    id: 'fear',
    cat: 'nafsi',
    text: 'شنوّة أكثر حاجة تخوّفك في العلاقة؟',
    options: [
      { t: 'نخاف من الخيانة', s: { jealousy: 2, romance: 1 } },
      { t: 'نخاف من الروتين والملل', s: { adventure: 2 } },
      { t: 'نخاف نخسر حرّيتي', s: { independence: 2 } },
    ],
  },
  {
    id: 'lovelang',
    cat: 'nafsi',
    text: 'كيفاش تعبّر على الحب؟ 💌',
    options: [
      { t: 'بالكلام الحلو', s: { romance: 2 } },
      { t: 'بالأفعال، نكون ديما {@حاضر|حاضرة}', s: { calm: 1, tradition: 1 } },
      { t: 'بالكادوات والمفاجآت 🎁', s: { romance: 1, adventure: 1 } },
    ],
  },
  {
    id: 'jealous',
    cat: 'nafsi',
    text: 'بالصراحة… تعتبر روحك {@غيور|غيورة}؟ 😤',
    options: [
      { t: 'إيه برشا، ما نخبّيش', s: { jealousy: 3 } },
      { t: 'شويّة، كيف الناس الكل', s: { jealousy: 1, romance: 1 } },
      { t: 'لا، عندي ثقة', s: { calm: 2, independence: 1 } },
    ],
  },
  {
    id: 'decision',
    cat: '3ala9a',
    text: 'القرارات الكبيرة في العلاقة، شكون ياخذها؟',
    options: [
      { t: 'ناخذوها الزوز مع بعضنا', s: { calm: 2, romance: 1 } },
      { t: 'أنا، نظرتي أوضح', s: { jealousy: 1, independence: 2 } },
      { t: 'نخلّي القرار {ليه|ليها}', s: { tradition: 2 } },
    ],
  },
  {
    id: 'sad',
    cat: 'nafsi',
    text: 'كي تكون {@مقلّق|مقلّقة} ولا {@حزين|حزينة}، شنوّة تحتاج؟',
    options: [
      { t: 'حد يحضني وما يحكيش 🤍', s: { romance: 2 } },
      { t: 'حد يسمعني للآخر', s: { calm: 2 } },
      { t: 'نحب نقعد وحدي شويّة', s: { independence: 2 } },
    ],
  },
  {
    id: 'money',
    cat: '3ala9a',
    text: 'بعد العرس، الفلوس كيفاش تتقسم؟ 💰',
    options: [
      { t: 'كل شيء مشترك بيناتنا', s: { romance: 2 } },
      { t: 'كل واحد فلوسو', s: { independence: 2 } },
      { t: 'الراجل هو المسؤول على مصروف الدار', s: { tradition: 2 } },
    ],
  },
  {
    id: 'family',
    cat: '3ala9a',
    text: 'العايلة تنجم تتدخّل في علاقتكم؟ 👨‍👩‍👧',
    options: [
      { t: 'إيه، رأي العايلة مهم برشا', s: { tradition: 2 } },
      { t: 'نسمع منهم أما القرار ليّا', s: { independence: 1, calm: 1 } },
      { t: 'لا، علاقتنا متاعنا', s: { independence: 2 } },
    ],
  },
  {
    id: 'change',
    cat: 'nafsi',
    text: 'كان تنجم تبدّل حاجة وحدة في شخصيتك، شنوّة تبدّل؟',
    options: [
      { t: 'نولّي أهدى شويّة', s: { jealousy: 1, adventure: 1 } },
      { t: 'نولّي أجرأ شويّة', s: { calm: 1, tradition: 1 } },
      { t: 'ما نبدّل شي، نحب روحي هكّا 😎', s: { independence: 2, humor: 1 } },
    ],
  },
  {
    id: 'waiter',
    cat: 'mawa9ef',
    text: 'خرجتو تتعشّاو والسرفور جابلك كوموند غالطة… شنوّة تعمل؟',
    options: [
      { t: 'نسكت وناكل اللي جا', s: { calm: 1, tradition: 1 } },
      { t: 'نقلّو بلطف', s: { calm: 2 } },
      { t: 'نضحك ونعملها نكتة 😂', s: { humor: 2 } },
    ],
  },
  {
    id: 'birthday',
    cat: 'mawa9ef',
    text: '{شريكك} {نسى|نسات} عيد ميلادك… شنوّة تعمل؟ 🎂',
    options: [
      { t: 'نتغشّش برشا', s: { romance: 1, jealousy: 2 } },
      { t: 'نفكّر{و|ها} ونعدّيها', s: { calm: 2 } },
      {
        t: 'نعمل روحي ما يهمّنيش… ونخزّن{هالو|هالها} 😤',
        s: { jealousy: 2, humor: 1 },
      },
    ],
  },
  {
    id: 'bestie',
    cat: 'mawa9ef',
    text: '{@صاحبك المقرّب ما يحبّش|صاحبتك المقرّبة ما تحبّش} {شريكك}… مع شكون توقف؟',
    options: [
      { t: 'نسمع {@منّو|منها} ونخمّم قبل', s: { calm: 2 } },
      { t: 'نختار {حبيبي|حبيبتي}', s: { romance: 2 } },
      {
        t: '{@صاحبي عندو|صاحبتي عندها} الأولوية',
        s: { tradition: 1, independence: 1 },
      },
    ],
  },
  {
    id: 'music',
    cat: 'fadlaka',
    text: 'في الكرهبة، شكون يختار المزيكة؟ 🎶',
    options: [
      { t: 'أنا ديما، ما فيهاش نقاش', s: { independence: 1, jealousy: 1 } },
      { t: 'نبدّلو بالدور', s: { calm: 2 } },
      { t: 'بلاش مزيكة، خلّينا نحكيو', s: { romance: 2 } },
    ],
  },
  {
    id: 'gift',
    cat: 'mawa9ef',
    text: '{شريكك} {جابلك|جابتلك} كادو ما عجبك بالكل… شنوّة {تقلّو|تقلّها}؟',
    options: [
      { t: '{نقلّو|نقلّها} عجبني ونخبّيه', s: { romance: 1, calm: 1 } },
      { t: 'نفرح بالنيّة، هذا يكفي', s: { romance: 2 } },
      { t: 'نضحك و{نقلّو|نقلّها} "شنوّة هذا؟" 😂', s: { humor: 2 } },
    ],
  },
  {
    id: 'trip',
    cat: 'fadlaka',
    text: 'كي تسافرو مع بعضكم، كيفاش تحبّو السفرة؟ ✈️',
    options: [
      { t: 'كل شيء مخطّط من قبل', s: { calm: 1, tradition: 1 } },
      { t: 'على البركة، نشوفو وين نوصلو', s: { adventure: 2 } },
      { t: 'شويّة تخطيط وشويّة مغامرة', s: { adventure: 1, calm: 1 } },
    ],
  },
  {
    id: 'work',
    cat: 'mawa9ef',
    text: 'عندك مشكلة في الخدمة وعندك موعد مع {شريكك} الليلة… شنوّة تعمل؟',
    options: [
      { t: 'نبطّل الموعد', s: { independence: 2 } },
      { t: 'نجي ونحكي{لو|لها} على المشكلة', s: { romance: 1, calm: 1 } },
      { t: 'نجي وننسى الخدمة الكل', s: { adventure: 1, humor: 1 } },
    ],
  },
  {
    id: 'redflag',
    cat: 'jor2a',
    text: 'شنوّة أكبر red flag 🚩 عندك في العلاقة؟',
    options: [
      { t: 'الكذب، ما نقبلوش', s: { calm: 1, tradition: 1 } },
      { t: 'الغيرة الزايدة', s: { independence: 2 } },
      { t: 'شخصية ما تضحكش', s: { humor: 2 } },
    ],
  },
  {
    id: 'firstdate',
    cat: 'fadlaka',
    text: 'شنوّة أوّل موعد مثالي على الطريقة التونسية؟ 🇹🇳',
    options: [
      { t: 'قهوة في سيدي بوسعيد ☕', s: { calm: 1, romance: 1 } },
      { t: 'عشاء رومانسي في المرسى 🕯️', s: { romance: 2 } },
      { t: 'حاجة مجنونة: karting ولا escape game', s: { adventure: 2 } },
    ],
  },
  {
    id: 'style',
    cat: 'jor2a',
    text: '{شريكك} {طلب|طلبت} منك تبدّل الستيل متاعك… شنوّة تعمل؟',
    options: [
      { t: 'نبدّل كان {يفرّحو|يفرّحها}', s: { romance: 2 } },
      { t: 'لا، أنا هكّا ونقعد هكّا', s: { independence: 2 } },
      { t: '{يبدّل هو|تبدّل هي} قبل 😏', s: { humor: 1, jealousy: 1 } },
    ],
  },
  {
    id: 'sorry',
    cat: '3ala9a',
    text: 'في الخصام، شكون يطلب السماح الأوّل؟',
    options: [
      { t: 'أنا ديما نطلب السماح', s: { romance: 2, calm: 1 } },
      { t: 'اللي غالط هو اللي يطلب', s: { calm: 1, independence: 1 } },
      { t: 'نبعث meme ونعدّيوها 😂', s: { humor: 2 } },
    ],
  },
  {
    id: 'firstsight',
    cat: '3ala9a',
    text: 'تآمن بالحب من أوّل نظرة؟ 😍',
    options: [
      { t: 'إيه، وصارتلي', s: { romance: 2, adventure: 1 } },
      { t: 'لا، الحب يجي بالعشرة', s: { calm: 1, tradition: 1 } },
      { t: 'ممكن… توّا نشوفو 😉', s: { humor: 1, adventure: 1 } },
    ],
  },
  {
    id: 'texting',
    cat: '3ala9a',
    text: 'قدّاش تحب تحكيو مع بعضكم في النهار؟',
    options: [
      { t: 'طول النهار، مساجات ديما', s: { romance: 1, jealousy: 1 } },
      { t: 'مرّة ولا زوز في النهار، يكفي', s: { independence: 2 } },
      { t: 'كي يكون عندنا ما نقولو', s: { calm: 2 } },
    ],
  },
  {
    id: 'unforgivable',
    cat: 'nafsi',
    text: 'شنوّة الحاجة اللي ما تسامحش فيها بالكل؟',
    options: [
      { t: 'الخيانة، ما فيهاش سماح', s: { jealousy: 1, tradition: 1 } },
      { t: 'قلّة الاحترام قدّام الناس', s: { tradition: 2 } },
      { t: 'الأنانية', s: { romance: 2 } },
    ],
  },
  {
    id: 'mind',
    cat: 'fadlaka',
    text: 'كان تنجم تقرا أفكار {شريكك} توّا… تقراها؟ 🔮',
    options: [
      {
        t: 'إيه، نحب نعرف شنوّة {يخمّم|تخمّم}',
        s: { jealousy: 1, adventure: 1 },
      },
      { t: 'لا، نحب السوسبانس', s: { romance: 1, adventure: 1 } },
      { t: 'نعرف ديجا شنوّة {يخمّم|تخمّم} 😏', s: { humor: 2 } },
    ],
  },
  {
    id: 'ideal',
    cat: 'fadlaka',
    text: 'من ناحية العمر، كيفاش تحب {شريكك} {يكون|تكون}؟',
    options: [
      { t: 'نحب {يكون|تكون} أكبر منّي', s: { tradition: 2 } },
      { t: 'نحب {يكون|تكون} في عمري', s: { calm: 2 } },
      { t: 'العمر ما يهمّش، المهم القلب', s: { romance: 2 } },
    ],
  },
  {
    id: 'wedding',
    cat: '3ala9a',
    text: 'العرس متاعكم كيفاش تحبّو يكون؟ 👰🤵',
    options: [
      {
        t: 'عرس تونسي كامل: حنّة، طبّال وسبع ليالي 🥁',
        s: { tradition: 2, humor: 1 },
      },
      { t: 'حاجة صغيرة مع العايلة والصحاب', s: { calm: 2, romance: 1 } },
      { t: 'نهربو ونعرّسو في جزيرة 🏝️', s: { adventure: 2, independence: 1 } },
    ],
  },
  {
    id: 'mother',
    cat: 'jor2a',
    text: 'أمّك و{شريكك} تخاصمو… مع شكون توقف؟ 😬',
    options: [
      { t: 'مع أمّي، الأم ما تتعوّضش', s: { tradition: 2 } },
      { t: 'مع اللي عندو الحق', s: { calm: 2, independence: 1 } },
      { t: 'نهرب ونسكّر التليفون 😂', s: { humor: 2 } },
    ],
  },
  {
    id: 'house',
    cat: '3ala9a',
    text: 'بعد العرس، وين تحبّو تسكنو؟ 🏠',
    options: [
      { t: 'دار وحدنا، بعيد شويّة على العايلة', s: { independence: 2 } },
      { t: 'قريب من العايلة، باش نزوروهم', s: { tradition: 1, calm: 1 } },
      { t: 'نخرجو برّا تونس نبداو من جديد ✈️', s: { adventure: 2 } },
    ],
  },
  {
    id: 'cook',
    cat: 'fadlaka',
    text: 'بعد العرس، شكون يطيّب في الدار؟ 🍲',
    options: [
      {
        t: 'أنا، كسكسي ومقرونة بالصلصة على يدي',
        s: { tradition: 1, romance: 1 },
      },
      { t: 'نطيّبو الزوز مع بعضنا', s: { calm: 1, romance: 1 } },
      { t: 'نطلبو Glovo ولا نمشيو للماما 😂', s: { humor: 2 } },
    ],
  },
]

const CODES: Record<string, Trait> = {
  r: 'romance',
  a: 'adventure',
  j: 'jealousy',
  i: 'independence',
  h: 'humor',
  t: 'tradition',
  c: 'calm',
}

function expand(mode: Mode, cat: Category, raw: RawQuestion[]): Question[] {
  return raw.map(([text, ...opts], i) => ({
    id: `${cat}_${i}`,
    cat,
    mode,
    text,
    options: opts.map(([t, w]) => ({
      t,
      s: Object.fromEntries(
        w
          .split(/\s+/)
          .filter(Boolean)
          .map((c) => [CODES[c[0]], Number(c.slice(1)) || 1]),
      ),
    })),
  }))
}

export const QUESTIONS: Question[] = [
  ...CLASSICS.map((q) => ({ ...q, mode: 'date' as const })),
  ...expand('date', 'flous', FLOUS),
  ...expand('date', 'mocharka', MOCHARKA),
  ...expand('date', '3ayla', AYLA),
  ...expand('date', 'ndhafa', NDHAFA),
  ...expand('date', 'khiyana', KHIYANA),
  ...expand('date', '7orriya', HORRIYA),
  ...expand('date', '3ark', ARK),
  ...expand('date', 'nafsi', NAFSI),
  ...expand('friends', 'nadhra', NADHRA),
  ...expand('friends', 'mawqef', MAWQEF),
  ...expand('friends', 'i7raj', IHRAJ),
  ...expand('friends', 'flous_s', FLOUS_S),
  ...expand('friends', 'sirr', SIRR),
  ...expand('friends', '3ark_s', ARK_S),
  ...expand('friends', 'saraha', SARAHA),
]

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]))

export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id)
}

// The last 5 questions of a date are about marriage, and are worded differently for men and women.
// Options are always ordered from "full partnership" (v 0) to "traditional roles" (v 2);
// `a` is the line about the person who picked it in their final report.
export type MarriageOption = { t: string; a: string }
export type MarriageQuestion = {
  id: string
  topic: string
  male: { text: string; options: MarriageOption[] }
  female: { text: string; options: MarriageOption[] }
}

const BASE_MARRIAGE: MarriageQuestion[] = [
  {
    id: 'mar_work',
    topic: '💼 الخدمة بعد العرس',
    male: {
      text: 'بعد العرس، مرتك تخدم ولا تقعد في الدار؟',
      options: [
        { t: 'تخدم كان تحب، القرار متاعها', a: 'يحترم استقلالية مرتو ويشوف خدمتها حق موش مزيّة.' },
        { t: 'تخدم، أما الدار والصغار قبل كل شي', a: 'ما عندوش مشكل مع خدمتها، أما ينتظر منها توازن والدار أولويّة.' },
        { t: 'نحبها تقعد في الدار وأنا نتكفّل بكل شي', a: 'يشوف روحو المسؤول على المصروف، ويحب مرتو تتفرّغ للدار.' },
      ],
    },
    female: {
      text: 'بعد العرس، تحب تكمّل تخدم؟',
      options: [
        { t: 'إيه، خدمتي واستقلالي المادي خط أحمر', a: 'خدمتها جزء من شخصيتها، وما تتنازلش على استقلالها.' },
        { t: 'نخدم، أما العائلة قبل كل شي', a: 'تحب تخدم، أما مستعدّة تنقّص كان الدار تحتاجها.' },
        { t: 'نحب نقعد في الدار ونربّي صغاري', a: 'تشوف دورها الأساسي في الدار، وتستنّى من راجلها يتكفّل بالمصروف.' },
      ],
    },
  },
  {
    id: 'mar_money',
    topic: '💰 الفلوس',
    male: {
      text: 'الشهرية متاعك ومتاع مرتك، كيفاش تتصرّفو فيها؟',
      options: [
        { t: 'صندوق واحد، كل شي مع بعضنا', a: 'يشوف الزواج شراكة كاملة حتى في الفلوس.' },
        { t: 'كل واحد يعاون في الدار حسب قدرتو', a: 'يحب العدل: كل واحد يعاون، وكل واحد يخلّي شويّة ليه.' },
        { t: 'مصروف الدار عليّ، وفلوسها ليها', a: 'يعتبر المصروف واجب الراجل، وما يمدّش يدّو لفلوس مرتو.' },
      ],
    },
    female: {
      text: 'فلوسك بعد العرس، كيفاش تتصرّف فيهم؟',
      options: [
        { t: 'نحطّوهم مع بعضنا، كل شي مشترك', a: 'تشوف الزواج شراكة كاملة حتى في الفلوس.' },
        { t: 'نعاون في الدار حسب قدرتي', a: 'تحب تساهم، أما تخلّي شويّة ليها وتحب الوضوح.' },
        { t: 'فلوسي ليّا، ومصروف الدار على الراجل', a: 'تعتبر المصروف واجب الراجل، وفلوسها حقّها.' },
      ],
    },
  },
  {
    id: 'mar_home',
    topic: '🏠 السكنى والعايلة',
    male: {
      text: 'وين تحب تسكنو بعد العرس؟',
      options: [
        { t: 'دار وحدنا، بعيد شويّة على العايلة', a: 'يحب خصوصية الزوج، والعايلة في زيارات.' },
        { t: 'دار وحدنا، أما قريب من العايلة', a: 'يحب يكون مستقل، أما مربوط بعايلتو ويحب يكون قريب منهم.' },
        { t: 'مع الوالدين في نفس الدار', a: 'العايلة عندو أولويّة كبيرة، ويشوف السكنى معاهم عادية.' },
      ],
    },
    female: {
      text: 'تقبل تسكن مع عايلة راجلك؟',
      options: [
        { t: 'لا، دار وحدنا وخلاص', a: 'خصوصية الزوج عندها خط أحمر.' },
        { t: 'قريب منهم إيه، معاهم لا', a: 'تحب العايلة قريبة، أما كل واحد في دارو.' },
        { t: 'إيه، عادي العايلة عايلة', a: 'منفتحة على العايلة الكبيرة وما تشوفش مشكل في السكنى معاهم.' },
      ],
    },
  },
  {
    id: 'mar_decide',
    topic: '⚖️ القرارات والخلافات',
    male: {
      text: 'كي تختلف مع مرتك في قرار كبير، شكون عندو الكلمة الأخيرة؟',
      options: [
        { t: 'نتناقشو حتى نلقاو حل يرضي الزوز', a: 'يشوف القرار مشترك، ويعتمد على الحوار.' },
        { t: 'كل واحد يقرّر في مجالو', a: 'يحب تقسيم واضح: كل واحد مسؤول على حاجات.' },
        { t: 'أنا راجل الدار، كلمتي الأخيرة', a: 'يشوف روحو رأس العائلة، والقرار الأخير عندو.' },
      ],
    },
    female: {
      text: 'كي تختلف مع راجلك في قرار كبير، شنوّة تعمل؟',
      options: [
        { t: 'نتناقشو حتى نلقاو حل يرضي الزوز', a: 'تشوف القرار مشترك، وتعتمد على الحوار.' },
        { t: 'كل واحد يقرّر في مجالو', a: 'تحب تقسيم واضح: كل واحد مسؤول على حاجات.' },
        { t: 'نخلّي الكلمة الأخيرة ليه', a: 'تثق في راجلها وتخلّيلو القرار الأخير.' },
      ],
    },
  },
  {
    id: 'mar_house',
    topic: '🧹 شغل الدار والصغار',
    male: {
      text: 'شغل الدار وتربية الصغار، قدّاش تعاون فيهم؟',
      options: [
        { t: 'بالشطر، كل شي مع بعضنا', a: 'مستعد يدخل للكوجينة ويبدّل الحفّاظات، الدار مسؤولية الزوز.' },
        { t: 'نعاون، أما هي الأساس', a: 'يعاون كي يلزم، أما يشوف الدار أكثر مسؤولية مرتو.' },
        { t: 'الدار على المرا، وأنا على الخدمة', a: 'يقسم الأدوار على الطريقة الكلاسيكية: هو برّا وهي في الدار.' },
      ],
    },
    female: {
      text: 'شغل الدار وتربية الصغار، شنوّة تستنّى من راجلك؟',
      options: [
        { t: 'بالشطر، كل شي مع بعضنا', a: 'تستنّى من راجلها يشاركها في كل شي، الدار موش عليها وحدها.' },
        { t: 'نتكفّل بالأغلبية، أما يعاوني', a: 'تقبل تكون هي الأساس، بشرط راجلها يعاونها.' },
        { t: 'الدار عليّ، وهو على المصروف', a: 'تقسم الأدوار على الطريقة الكلاسيكية: هو برّا وهي في الدار.' },
      ],
    },
  },
]

export const MARRIAGE_QUESTIONS: MarriageQuestion[] = [...BASE_MARRIAGE, ...MORE_MARRIAGE]

const MARRIAGE_BY_ID = new Map(MARRIAGE_QUESTIONS.map((q) => [q.id, q]))

export function getMarriageQuestion(id: string): MarriageQuestion | undefined {
  return MARRIAGE_BY_ID.get(id)
}

/**
 * Questions are written once and worded for each player when shown:
 * - {شريكك} / {صاحبك} become شريكتك / صاحبتك when the other player is a woman.
 * - {m|f} picks the masculine or feminine form for the other player, e.g. {معاه|معاها}.
 * - {@m|f} picks the form for the player answering, e.g. {@متأكّد|متأكّدة}.
 * Without a known gender the masculine form is used.
 */
export function personalize(
  text: string,
  gender: string | null | undefined,
  partnerGender: string | null | undefined,
) {
  const she = partnerGender === 'female'
  return text
    .replaceAll('{صاحبك}', she ? 'صاحبتك' : 'صاحبك')
    .replaceAll('{شريكك}', she ? 'شريكتك' : 'شريكك')
    .replace(/\{(@?)([^{}|]*)\|([^{}|]*)\}/g, (_, self, m, f) =>
      (self ? gender === 'female' : she) ? f : m,
    )
}

/**
 * The question as one player sees it, worded for both genders (see `personalize`).
 * Marriage questions have a separate version for men and women. `finale` marks the last 5 of a room.
 */
export function questionFor(
  id: string,
  gender: string | null | undefined,
  partnerGender?: string | null,
) {
  const q = getQuestion(id)
  if (q) {
    return {
      text: personalize(q.text, gender, partnerGender),
      cat: q.cat,
      options: q.options.map((o) => personalize(o.t, gender, partnerGender)),
      marriage: false,
      finale: FINALE_CATS.has(q.cat),
    }
  }
  const m = getMarriageQuestion(id)
  if (!m) return undefined
  const v = gender === 'female' ? m.female : m.male
  return {
    text: v.text,
    cat: 'zawej' as const,
    options: v.options.map((o) => o.t),
    marriage: true,
    finale: true,
  }
}

export const MAIN_QUESTIONS = 25
export const FINALE_QUESTIONS = 5
export const QUESTIONS_PER_DATE = MAIN_QUESTIONS + FINALE_QUESTIONS
export const QUESTION_SECONDS = 45
export const REVEAL_SECONDS = 4
export const INTRO_SECONDS = 5

const FINALE_CATS = new Set<Category>(['saraha'])

// Each room takes the same number from every core topic, so the final note covers them all
const CORE: Record<Mode, Category[]> = {
  date: ['flous', 'mocharka', '3ayla', 'ndhafa', 'khiyana', '7orriya', '3ark', 'nafsi'],
  friends: ['nadhra', 'mawqef', 'i7raj', 'flous_s', 'sirr', '3ark_s'],
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Shuffled ids with the ones the player has not seen yet first. */
function fresh(ids: string[], seen: Set<string>) {
  const s = shuffle(ids)
  return [...s.filter((id) => !seen.has(id)), ...s.filter((id) => seen.has(id))]
}

/**
 * Picks a random set of 30 for a new room: 25 spread over the mode's topics, then the 5
 * finale questions (marriage for a date, "الصراحة" for friends). Questions in `seen`
 * (the host's previous rooms) are only reused once the fresh ones run out.
 */
export function pickQuestionIds(mode: Mode = 'date', seenIds: string[] = []): string[] {
  const seen = new Set(seenIds)
  const pool = QUESTIONS.filter((q) => q.mode === mode && !FINALE_CATS.has(q.cat))
  const core = CORE[mode]
  const perTopic = Math.floor(MAIN_QUESTIONS / core.length)
  const picked: string[] = []
  for (const cat of core) {
    picked.push(...fresh(pool.filter((q) => q.cat === cat).map((q) => q.id), seen).slice(0, perTopic))
  }
  const taken = new Set(picked)
  picked.push(
    ...fresh(pool.filter((q) => !taken.has(q.id)).map((q) => q.id), seen).slice(
      0,
      MAIN_QUESTIONS - picked.length,
    ),
  )
  const finale =
    mode === 'date'
      ? MARRIAGE_QUESTIONS.map((q) => q.id)
      : QUESTIONS.filter((q) => q.cat === 'saraha').map((q) => q.id)
  return [...shuffle(picked), ...fresh(finale, seen).slice(0, FINALE_QUESTIONS)]
}
