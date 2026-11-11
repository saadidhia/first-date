// The solo "play with the AI" mode: a personality test in Tunisian dialect.
// Every question measures one of 8 dimensions. Each dimension has two unhealthy poles
// (a and b) and a balanced middle, so the report can say not only "you need to work on
// this" but which way you lean, and quote the answers that show it.

import { AI_MACH, AI_NAFS, AI_SIRA3, AI_TA3AL } from './bank/ai-1'
import { AI_IRADA, AI_MA3NA, AI_NAS, AI_OPEN, AI_TAGHYIR } from './bank/ai-2'
import type { AiRawQuestion } from './bank/types'
import { personalize } from './questions'

export type Dim =
  | 'nafs'
  | 'mach'
  | 'ta3al'
  | 'sira3'
  | 'irada'
  | 'nas'
  | 'taghyir'
  | 'ma3na'

export type Pole = 'a' | 'b'

type PoleInfo = {
  /** Short name of the pattern, e.g. "تكتم مشاعرك" */
  name: string
  /** What the answers show */
  seen: string
  /** Why it matters */
  why: string
  /** Concrete things to practise */
  tips: string[]
}

type DimInfo = {
  label: string
  emoji: string
  /** Title of the profile when this is the strongest dimension */
  title: string
  strong: string
  a: PoleInfo
  b: PoleInfo
}

export const DIMS: Record<Dim, DimInfo> = {
  nafs: {
    label: 'الثقة في روحك',
    emoji: '🪞',
    title: '{@الثابت في روحو|الثابتة في روحها}',
    strong:
      'عندك ثقة صحّية في روحك: تقبل الغلطة وتقبل المدح، وما تحتاجش الناس الكل يوافقوك باش تحسّ بقيمتك.',
    a: {
      name: 'تصغّر في روحك',
      seen: 'أجوبتك تورّي اللي الصوت اللي في راسك قاسي معاك: تنقص من قيمتك، تحشم من الغلطة، وتستنّى رأي الناس باش تعرف قدّاش تسوى.',
      why: 'كي تشكّ في روحك، تسكت وقتلي لازمك تحكي، تقبل بأقل من حقّك، والفرص تفوت عليك موش على خاطر ما تستاهلهاش، على خاطر ما طلبتهاش.',
      tips: [
        'كل ليلة اكتب 3 حاجات عملتهم مليح في النهار، حتى كان صغار. مخّك متعوّد يشوف الغلطات برك، لازمك تدرّبو يشوف الباقي.',
        'كي يمدحك حد، قول "يعيّشك" وبرّا. ما تنقّصش من المدح وما تبرّرش.',
        'كي تسمع روحك تقول "ما نصلح لشي"، اسأل: "كان صاحبي قال هكّا على روحو، شنوّة نقلّو؟" وقولها لروحك.',
      ],
    },
    b: {
      name: 'تدافع على صورتك برشا',
      seen: 'أجوبتك تورّي اللي صعيب عليك تقبل إنك {@غالط|غالطة} ولا اللي حد أحسن منك في حاجة. تحمي صورتك قبل ما تسمع.',
      why: 'الثقة الحقيقية ما تحتاجش تربح كل نقاش. كي ما تقبلش الغلطة ما تتعلّمش منها، والناس القريبين منك يبطلو يقولولك الحقيقة.',
      tips: [
        'الجمعة هاذي، قول "عندك الحق، ما خمّمتش فيها هكّا" مرّة على الأقل في نقاش.',
        'كي تحسّ روحك تحب تردّ طول على نقد، استنّى 10 ثواني واسأل: "شنوّة الصحيح في كلامو؟"',
        'اسأل زوز ناس تثق فيهم: "شنوّة حاجة وحدة نجّم نحسّنها فيّا؟" واسمع بلا ما تبرّر.',
      ],
    },
  },
  mach: {
    label: 'مشاعرك',
    emoji: '🌊',
    title: '{@اللي يفهم قلبو|اللي تفهم قلبها}',
    strong:
      'تعرف تحسّ وتعبّر بلا ما تكتم وبلا ما تنفجر. هاذي حاجة نادرة، وهي اللي تخلّي الناس ترتاح معاك.',
    a: {
      name: 'تكتم مشاعرك',
      seen: 'أجوبتك تورّي اللي تخبّي اللي تحسّ بيه: تقول "لاباس" وإنت موش لاباس، وتخزّن الجرح عوض ما تحكي عليه.',
      why: 'المشاعر المكتومة ما تمشيش: تولّي قلق، وجيعة راس، قلّة نوم، ولا انفجار في وقت موش وقتو. والناس اللي تحبّك ما ينجموش يعاونوك على حاجة ما يعرفوهاش.',
      tips: [
        'مرّة في النهار، سمّي اللي تحسّ بيه بكلمة دقيقة: "{@مقلّق|مقلّقة}" موش كافية، قول "{@غيران|غيرانة}" ولا "{@خايف|خايفة}" ولا "{@محشوم|محشومة}".',
        'اختار شخص واحد تثق فيه، وكي يسألك "لاباس؟" جاوبو بالحق مرّة في الجمعة.',
        'اكتب 5 دقايق كل ليلة على اللي ضايقك في النهار. الكتيبة تفرّغ اللي ما تنجمش تقولو.',
      ],
    },
    b: {
      name: 'مشاعرك تغلبك',
      seen: 'أجوبتك تورّي اللي المشاعر عندك قويّة وتجي مرّة وحدة: التقلّق يطلع بالزربة ولا الحزن يغرّقك، وتلقى روحك تقول ولا تعمل حاجات تندم عليها.',
      why: 'الإحساس القوي موش عيب، أما كي يولّي هو اللي يسوق، الكلام والقرارات يخرجو قبل ما تخمّم، والعلاقات تتجرح.',
      tips: [
        'قاعدة الدقيقة ونص: كي تحسّ الدم يغلي، ما تقول شي وما تبعث شي قبل 90 ثانية، وتنفّس بالشويّة (4 ثواني تدخّل، 6 تخرّج).',
        'لاحظ الإشارات الأولى في جسمك (صدرك يتشدّ، يديك يسخنو) وابعد شويّة قبل ما توصل للانفجار.',
        'بعد كل مرّة تتقلّق برشا، اكتب: شنوّة صار؟ شنوّة حسّيت؟ شنوّة كنت نحب نعمل عوض هكّا؟',
      ],
    },
  },
  ta3al: {
    label: 'التعلّق',
    emoji: '🔗',
    title: '{@القريب اللي يطمّن|القريبة اللي تطمّن}',
    strong:
      'تعرف تتعلّق بالناس بلا ما تذوب فيهم وبلا ما تهرب منهم. هذا هو الأساس متاع العلاقات اللي تدوم.',
    a: {
      name: 'تخاف تتخلّى',
      seen: 'أجوبتك تورّي اللي في العلاقات تعيش بخوف إنّك تخسر الناس: سكات صغير يولّي في راسك قصّة كبيرة، وتحتاج تطمين برشا.',
      why: 'الخوف من الفراق يخلّيك تقبل بحاجات ما تستاهلهاش، تتنازل برشا، وساعات تخنق الآخر بلا ما تحسّ. وهو يتعبك إنت قبل كل شي.',
      tips: [
        'كي ما يردّش عليك حد، اكتب 3 أسباب عادية (مشغول، راقد، تليفونو طافي) قبل ما تصدّق السبب الخايب.',
        'ابني حياة برّا العلاقة: هواية، صحاب، أهداف. كل ما حياتك تكون معمّرة، الخوف يصغار.',
        'عوض ما تطلب التطمين بطريقة ملوّحة، قولها بالوضوح: "نحتاج نسمع منك اليوم، عندي نهار صعيب".',
      ],
    },
    b: {
      name: 'تبعد كي العلاقة تقرب',
      seen: 'أجوبتك تورّي اللي كي الناس يقربو برشا تحسّ بالخنقة وتبعد: تحلّ مشاكلك وحدك، وما تحبّش تحتاج حد.',
      why: 'الاستقلالية مزيّة، أما كي تولّي حيط، تحرم روحك من القرب اللي يعاون الواحد يعدّي الأيّامات الصعيبة. والناس اللي يحبّوك يحسّو روحهم برّا.',
      tips: [
        'الجمعة هاذي، احكي لشخص قريب على حاجة صغيرة تقلّقك. ما تحلّهاش وحدك المرّة هاذي.',
        'كي تحسّ روحك تحب تبعد بعد لحظة قريبة، لاحظ الإحساس هذا وما تهربش طول: اقعد معاه شويّة.',
        'اطلب عاونة في حاجة تنجم تعملها وحدك. الطلب موش ضعف، هو باب للقرب.',
      ],
    },
  },
  sira3: {
    label: 'الخلاف والحدود',
    emoji: '⚖️',
    title: '{@الصريح بلطف|الصريحة بلطف}',
    strong:
      'تعرف تقول "لا" وتدافع على روحك بلا ما تجرح. هاذي مهارة الناس الكل تحتاجها وقليل اللي عندهم.',
    a: {
      name: 'تسكت باش ترضي',
      seen: 'أجوبتك تورّي اللي تبلع برشا: تقول "إيه" وفي قلبك "لا"، تتنازل على حقّك باش ما تصيرش مشكلة، وتحسّ بالذنب كي تختار روحك.',
      why: 'كل "إيه" ما تحبّهاش تتخزّن، وتولّي تعب ورغبة باش تبعد على الناس. والناس يتعلّمو اللي ينجمو ياخذو منك بلا حساب، موش على خاطرهم خايبين، على خاطرك ما قلتلهمش.',
      tips: [
        'ابدا بـ "لا" صغيرة الجمعة هاذي، في حاجة ما تكلّفش برشا.',
        'كي يطلب منك حد حاجة، قول "خلّيني نشوف ونقلّك" عوض "إيه" طول. الوقت يعطيك فرصة تختار.',
        'احكي بصيغة "أنا": "أنا ما نرتاحش كي…" عوض ما تسكت ولا تتّهم.',
      ],
    },
    b: {
      name: 'تهجم في الخلاف',
      seen: 'أجوبتك تورّي اللي في الخلاف تحب تربح: الصوت يعلى، الكلام يثقل، ولا تعاقب بالسكات حتى الآخر يفهم وحدو.',
      why: 'تنجم تربح النقاش وتخسر الشخص. الناس اللي يتعاملو معاك يولّيو يخبّيو عليك ولا يبعدو، والمشكل الأصلي ما يتحلّش.',
      tips: [
        'في الخلاف الهدف هو "نحلّو"، موش "نربح". قبل ما تحكي اسأل روحك: "نحب يكون عندي الحق ولا نحب نتفاهمو؟"',
        'عاود كلام الآخر بكلماتك قبل ما تردّ: "إذا فهمتك، إنت تقول…". هاذي تطيّح السخانة برشا.',
        'عوض العقاب بالسكات، قول جملة وحدة: "توّا {@مقلّق|مقلّقة}، نحكيو بعد ساعة".',
      ],
    },
  },
  irada: {
    label: 'الإرادة والانضباط',
    emoji: '🎯',
    title: '{@اللي يكمّل اللي يبداه|اللي تكمّل اللي تبداه}',
    strong:
      'عندك انضباط صحّي: تخدم على أهدافك بلا ما تجلد روحك، وتعرف ترتاح.',
    a: {
      name: 'تأجّل',
      seen: 'أجوبتك تورّي اللي الحاجات المهمّة تتأجّل عندك: تبدا بالحماس وتوقف، التليفون ياكل وقت برشا، والهدف يقعد في راسك.',
      why: 'التأجيل في أغلب الأحيان موش كسل: هو هروب من إحساس (خوف، ملل، ما نعرفش منين نبدا). وكل تأجيل يثقّل الحاجة أكثر ويضرب ثقتك في روحك.',
      tips: [
        'قاعدة الـ 5 دقايق: قول لروحك "نخدم 5 دقايق برك". أغلب المرّات تكمّل.',
        'قسّم كل هدف لخطوة صغيرة برشا تتعمل اليوم (موش "نتعلّم الإنجليزية"، "نسمع 10 دقايق بودكاست").',
        'حطّ التليفون في بيت أخرى وقت الخدمة. ما تعوّلش على الإرادة، بدّل اللي حولك.',
      ],
    },
    b: {
      name: 'تضغط على روحك برشا',
      seen: 'أجوبتك تورّي اللي تحب الكمال: الغلطة الصغيرة تقلّقك، الراحة تحسّ بيها ذنب، وكي ما توفيش بوعد تجلد روحك.',
      why: 'الكمالية تبان مزيّة، أما هي تعب: تأخّرك (ما تسلّمش حتى تكون perfect)، تحرقك، وتخلّيك ما تفرحش باللي وصلتلو.',
      tips: [
        'خطّط للراحة كيف ما تخطّط للخدمة: نص نهار في الجمعة بلا إنتاجية، وهو جزء من البرنامج.',
        'قبل ما تبدا حاجة، حدّد شنوّة هو "كافي" (موش "كامل")، ووقف كي توصلّو.',
        'كي تغلط، احكي مع روحك كيف ما تحكي مع صاحبك: "صارت، نتعلّم ونكمّل".',
      ],
    },
  },
  nas: {
    label: 'التعاطف',
    emoji: '🤍',
    title: 'القلب الكبير',
    strong:
      'عندك تعاطف متوازن: تحسّ بالناس وتعاونهم، وفي نفس الوقت ما تنساش روحك.',
    a: {
      name: '{@بعيد|بعيدة} على مشاعر الناس',
      seen: 'أجوبتك تورّي اللي تتعامل مع مشاكل الناس بالعقل أكثر من القلب: تعطي الحل بالزربة، تبعد كي يكون فمّا حزن، وساعات ما تلاحظش اللي حد موش لاباس.',
      why: 'الناس ساعات ما يحتاجوش حل، يحتاجو يحسّو روحهم مسموعين. كي ما يلقاوش هذا عندك يبطلو يحكيولك، وتخسر قرب كان ينجم يكون.',
      tips: [
        'في الحكاية الجاية، ما تعطيش حل قبل ما تسأل: "تحب نسمعك برك ولا تحب رايي؟"',
        'كي حد يحكيلك، سمّي إحساسو: "يظهرلي هاذي وجعتك" عوض "عادي، تتعدّى".',
        'مرّة في الجمعة، ابعث لحد قريب "كيفاش حالك بالحق؟" وأعطيه وقت يجاوب.',
      ],
    },
    b: {
      name: 'تنسى روحك مع الناس',
      seen: 'أجوبتك تورّي اللي تحمل همّ الناس كأنّو همّك: تعطي من وقتك وفلوسك أكثر من طاقتك، تسامح حتى كي الغلط يتعاود، وما تلقى حد يسألك إنت كيفاش.',
      why: 'الطيبة بلا حدود تولّي تعب، وساعات استغلال. ما تنجمش تعطي من كاس فارغ، وكي تتعب، الناس اللي تحبهم هوما زادة يخسرو.',
      tips: [
        'قبل ما تقول "إيه" لطلب، اسأل روحك: "عندي الطاقة توّا؟" إذا لا، قول "توّا ما نجمش".',
        'اكتب ليستة بالناس اللي يسألو عليك إنت. إذا قصيرة، هاذي إشارة باش تبني علاقات فيها أخذ وعطاء.',
        'العاونة موش معناها تحلّ مشاكل الناس في بلاصتهم. عاون، أما خلّي كل واحد يحمل حملو.',
      ],
    },
  },
  taghyir: {
    label: 'التغيير والجديد',
    emoji: '🧭',
    title: '{@المكتشف|المكتشفة}',
    strong:
      'عندك توازن بين الاستقرار والتجديد: تجرّب، تتعلّم، وتعرف وقتاش تثبت.',
    a: {
      name: 'تخاف من الجديد',
      seen: 'أجوبتك تورّي اللي تحب الأمان والحاجة اللي تعرفها، حتى كي ما تكونش {@مرتاح|مرتاحة} فيها: التغيير يقلّقك، والرأي المختلف تبعد عليه.',
      why: 'الاستقرار باهي، أما الخوف من التغيير يخلّيك تقعد في بلايص (خدمة، علاقة، عادات) كبرت عليهم. والدنيا تتبدّل، واللي ما يتأقلمش يتعب أكثر.',
      tips: [
        'جرّب حاجة جديدة صغيرة كل جمعة: ثنية أخرى، ماكلة، كتاب في موضوع ما تعرفوش.',
        'كي تخاف من قرار، اكتب: "شنوّة أسوأ حاجة تنجم تصير؟ وكان صارت، شنوّة نعمل؟" الخوف يصغار كي يولّي واضح.',
        'احكي مع شخص عندو رأي مختلف عليك، بنيّة تفهم موش تقنع.',
      ],
    },
    b: {
      name: 'ما تستقرّش',
      seen: 'أجوبتك تورّي اللي تملّ بالزربة: تبدا برشا حاجات وما تكمّلهمش، الروتين يخنقك، والقرارات الكبيرة تاخذها بالإحساس في دقيقة.',
      why: 'الفضول مزيّة كبيرة، أما بلا عمق يولّي جري. الحاجات اللي عندها قيمة (مهارة، علاقة، مشروع) لازمها تعدّي مرحلة الملل باش تعطي ثمارها.',
      tips: [
        'اختار حاجة وحدة (هواية، مشروع) والتزم بيها 3 شهور قبل ما تبدّل.',
        'قبل أي قرار كبير، استنّى 48 ساعة. إذا الحماس مازال، امشي.',
        'كي تملّ في علاقة ولا خدمة، اسأل: "نجّم نجدّد من الداخل؟" قبل ما تمشي.',
      ],
    },
  },
  ma3na: {
    label: 'الطموح والمعنى',
    emoji: '🌱',
    title: '{@اللي يعرف وين ماشي|اللي تعرف وين ماشية}',
    strong:
      'عندك طموح صحّي: تعرف شنوّة يهمّك، تخدم عليه، وتفرح بالثنية موش كان بالوصول.',
    a: {
      name: '{@ماشي|ماشية} بلا اتجاه',
      seen: 'أجوبتك تورّي اللي مازلت ما لقيتش شنوّة يحرّكك: الأيّامات تشبه لبعضها، الأهداف موش واضحة، وساعات تمشي على التصوّر اللي عملوهولك الناس.',
      why: 'بلا اتجاه، الوقت يفوت وإحساس الفراغ يكبر. موش لازم يكون عندك "رسالة كبيرة"، أما لازمك حاجة تقوم عليها الصباح.',
      tips: [
        'اكتب 3 لحظات في حياتك حسّيت فيهم بالحق إنك {@حي|حيّة}. شنوّة يجمعهم؟ منّا يبدا الاتجاه.',
        'حطّ هدف واحد صغير للشهر هذا، يكون متاعك إنت، موش متاع العايلة ولا الناس.',
        'جرّب حاجة تعاون بيها الناس (تطوّع، تقرّي حد، عاونة). المعنى ساعات يجي من العطاء.',
      ],
    },
    b: {
      name: 'تقارن روحك وتحرق روحك',
      seen: 'أجوبتك تورّي اللي عندك طموح كبير أما مخلوط بالمقارنة والضغط: ديما تحسّ روحك {@متأخّر|متأخّرة}، النجاح ما تفرحش بيه، والراحة تولّي ذنب.',
      why: 'المقارنة تسرق الفرحة: ديما فمّا حد قدّامك. والضغط بلا راحة يوصّل للحرقة (burnout)، وهوني الطموح ينقلب عليك.',
      tips: [
        'نقّص الوقت على إنستغرام، ولا اعمل unfollow للحسابات اللي تخلّيك تحسّ روحك {@ناقص|ناقصة}.',
        'قارن روحك بروحك من عام، موش بالناس: اكتب شنوّة تعلّمت وفي شنوّة كبرت.',
        'كل ما تكمّل هدف، احتفل قبل ما تبدا الجاي. حتى قهوة وحدك تكفي.',
      ],
    },
  },
}

export const DIM_ORDER: Dim[] = [
  'nafs',
  'mach',
  'ta3al',
  'sira3',
  'irada',
  'nas',
  'taghyir',
  'ma3na',
]

const BANK: Record<Dim, AiRawQuestion[]> = {
  nafs: AI_NAFS,
  mach: AI_MACH,
  ta3al: AI_TA3AL,
  sira3: AI_SIRA3,
  irada: AI_IRADA,
  nas: AI_NAS,
  taghyir: AI_TAGHYIR,
  ma3na: AI_MA3NA,
}

export type AiOption = { t: string; points: number; pole: Pole | null }
export type AiQuestion = { id: string; dim: Dim; text: string; options: AiOption[] }

function parseCode(code: string): { points: number; pole: Pole | null } {
  if (code === '2') return { points: 2, pole: null }
  return { points: Number(code[1]), pole: code[0] as Pole }
}

export const AI_QUESTIONS: AiQuestion[] = DIM_ORDER.flatMap((dim) =>
  BANK[dim].map(([text, ...opts], i) => ({
    id: `ai_${dim}_${i}`,
    dim,
    text,
    options: opts.map(([t, code]) => ({ t, ...parseCode(code) })),
  })),
)

const BY_ID = new Map(AI_QUESTIONS.map((q) => [q.id, q]))
export const getAiQuestion = (id: string) => BY_ID.get(id)

export const AI_OPEN_IDS = AI_OPEN.map((_, i) => `ai_open_${i}`)
export function openQuestionText(id: string | null | undefined, gender?: string | null) {
  const i = id?.startsWith('ai_open_') ? Number(id.slice(8)) : NaN
  const text = AI_OPEN[i]
  return text ? personalize(text, gender, null) : null
}

/** Questions per dimension in one game (8 dimensions → 24 questions). */
export const AI_PER_DIM = 3

function shuffle<T>(list: T[], rand = Math.random): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Picks AI_PER_DIM questions per dimension (unseen ones first), then interleaves them so
 * the same topic never comes twice in a row. Returns the question ids and an open question.
 */
export function pickAiQuestions(seenIds: string[] = []) {
  const seen = new Set(seenIds)
  const perDim = DIM_ORDER.map((dim) => {
    const all = AI_QUESTIONS.filter((q) => q.dim === dim).map((q) => q.id)
    const fresh = shuffle(all.filter((id) => !seen.has(id)))
    const old = shuffle(all.filter((id) => seen.has(id)))
    return [...fresh, ...old].slice(0, AI_PER_DIM)
  })
  const ids: string[] = []
  let last: string[] | null = null
  for (let round = 0; round < AI_PER_DIM; round++) {
    const order = shuffle(perDim)
    // Never the same topic twice in a row across two rounds
    if (order[0] === last && order.length > 1) order.push(order.shift()!)
    for (const dimIds of order) {
      const id = dimIds[round]
      if (id) ids.push(id)
    }
    last = order[order.length - 1]
  }
  const openFresh = AI_OPEN_IDS.filter((id) => !seen.has(id))
  const openId = shuffle(openFresh.length ? openFresh : AI_OPEN_IDS)[0]
  return { questionIds: ids, openId }
}

/**
 * The order the options are shown in for one question: shuffled, but always the same for a
 * given game, so a refresh doesn't move them. Answers are stored as the original index.
 */
export function optionOrder(seed: number, index: number): number[] {
  let s = (seed * 2654435761 + index * 40503) >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  return shuffle([0, 1, 2], rand)
}

/** The question as the player sees it, worded for their gender. */
export function aiQuestionFor(id: string, gender: string | null | undefined) {
  const q = getAiQuestion(id)
  if (!q) return null
  return {
    id,
    dim: q.dim,
    category: `${DIMS[q.dim].emoji} ${DIMS[q.dim].label}`,
    text: personalize(q.text, gender, null),
    options: q.options.map((o) => personalize(o.t, gender, null)),
  }
}

// ——— The report ———

export type DimResult = {
  dim: Dim
  label: string
  emoji: string
  /** 0–100, 100 = fully balanced */
  score: number
  /** Which pole the unbalanced answers lean to, null when balanced */
  lean: Pole | null
  leanName: string | null
  /** The answers went both ways (e.g. keeps feelings in, then explodes) */
  mixed: boolean
  level: 'strong' | 'ok' | 'work'
}

export type Evidence = { question: string; answer: string }

export type WorkOn = DimResult & {
  seen: string
  why: string
  tips: string[]
  /** The questions and answers that show it, in the player's own words */
  evidence: Evidence[]
  /** When the answers go both ways: the other pattern, named */
  otherName: string | null
}

export type AiReport = {
  name: string
  title: string
  /** Average balance over all dimensions, 0–100 */
  balance: number
  dims: DimResult[]
  strengths: (DimResult & { text: string })[]
  workOn: WorkOn[]
  open: { id: string; question: string; answer: string } | null
  answered: number
}

const levelOf = (score: number): DimResult['level'] =>
  score >= 80 ? 'strong' : score >= 55 ? 'ok' : 'work'

/**
 * The private report for one game. `answers` maps question index → original option index.
 */
export function computeAiReport(input: {
  name: string
  gender: string | null | undefined
  questionIds: string[]
  answers: Record<string, number>
  openId?: string | null
  openAnswer?: string | null
}): AiReport {
  const g = (s: string) => personalize(s, input.gender, null)
  type Row = { q: AiQuestion; opt: AiOption; index: number }
  const rows: Row[] = []
  input.questionIds.forEach((id, index) => {
    const q = getAiQuestion(id)
    const pick = input.answers[String(index)]
    const opt = q && pick != null ? q.options[pick] : undefined
    if (q && opt) rows.push({ q, opt, index })
  })

  const dims: DimResult[] = []
  const rowsByDim = new Map<Dim, Row[]>()
  for (const dim of DIM_ORDER) {
    const mine = rows.filter((r) => r.q.dim === dim)
    if (!mine.length) continue
    rowsByDim.set(dim, mine)
    const points = mine.reduce((s, r) => s + r.opt.points, 0)
    const score = Math.round((points / (2 * mine.length)) * 100)
    // How far each answer pulls to each side: a "0" counts double a "1"
    const pull = { a: 0, b: 0 }
    for (const r of mine) if (r.opt.pole) pull[r.opt.pole] += 2 - r.opt.points
    const lean: Pole | null =
      pull.a === 0 && pull.b === 0 ? null : pull.a >= pull.b ? 'a' : 'b'
    const info = DIMS[dim]
    dims.push({
      dim,
      label: info.label,
      emoji: info.emoji,
      score,
      lean,
      leanName: lean ? g(info[lean].name) : null,
      mixed: pull.a > 0 && pull.b > 0,
      level: levelOf(score),
    })
  }

  const ranked = [...dims].sort((x, y) => y.score - x.score)
  const strengths = ranked
    .filter((d) => d.score >= 67)
    .slice(0, 3)
    .map((d) => ({ ...d, text: g(DIMS[d.dim].strong) }))

  // Up to 3 areas to work on; even a very balanced player gets their weakest one
  let weak = [...dims].sort((x, y) => x.score - y.score).filter((d) => d.lean)
  const below = weak.filter((d) => d.score < 67)
  weak = (below.length ? below : weak.slice(0, 1)).slice(0, 3)
  const workOn: WorkOn[] = weak.map((d) => {
    const info = DIMS[d.dim]
    const pole = info[d.lean!]
    const other = info[d.lean === 'a' ? 'b' : 'a']
    return {
      ...d,
      seen: g(pole.seen),
      why: g(pole.why),
      tips: pole.tips.map(g),
      evidence: (rowsByDim.get(d.dim) ?? [])
        .filter((r) => r.opt.points < 2)
        .sort((x, y) => x.opt.points - y.opt.points)
        .map((r) => ({ question: g(r.q.text), answer: g(r.opt.t) })),
      otherName: d.mixed ? g(other.name) : null,
    }
  })

  const balance = dims.length
    ? Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length)
    : 0
  const top = ranked[0]
  const openQ = openQuestionText(input.openId, input.gender)
  const openA = input.openAnswer?.trim()

  return {
    name: input.name,
    title: top ? `${DIMS[top.dim].emoji} ${g(DIMS[top.dim].title)}` : '',
    balance,
    dims,
    strengths,
    workOn,
    open:
      openQ && openA && input.openId
        ? { id: input.openId, question: openQ, answer: openA }
        : null,
    answered: rows.length,
  }
}
