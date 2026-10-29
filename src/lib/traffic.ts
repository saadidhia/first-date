// Where a visitor came from, worked out from the page referrer and the browser user agent.
// In-app browsers (Instagram, TikTok…) usually strip the referrer, so the user agent catches them;
// otherwise the referrer's host tells us (google, facebook…). Nothing means they came direct.

const IN_APP: [RegExp, string][] = [
  [/Instagram/i, 'instagram'],
  [/FBAN|FBAV|FB_IAB/i, 'facebook'],
  [/musical_ly|TikTok|BytedanceWebview/i, 'tiktok'],
  [/Snapchat/i, 'snapchat'],
  [/WhatsApp/i, 'whatsapp'],
]

const HOSTS: [RegExp, string][] = [
  [/instagram\./i, 'instagram'],
  [/(facebook\.|fb\.me|fb\.watch)/i, 'facebook'],
  [/(tiktok\.)/i, 'tiktok'],
  [/snapchat\./i, 'snapchat'],
  [/(whatsapp\.|wa\.me)/i, 'whatsapp'],
  [/(google\.|googlesyndication)/i, 'google'],
  [/(youtube\.|youtu\.be)/i, 'youtube'],
  [/(twitter\.|t\.co|x\.com)/i, 'twitter'],
  [/t\.me|telegram\./i, 'telegram'],
]

/** A short, normalised traffic source label (e.g. 'instagram', 'google', 'direct'). */
export function trafficSource(
  referrer: string | null | undefined,
  userAgent: string | null | undefined,
): string {
  const ua = userAgent ?? ''
  for (const [re, name] of IN_APP) if (re.test(ua)) return name

  const ref = (referrer ?? '').trim()
  if (!ref) return 'direct'
  let host = ref
  try {
    host = new URL(ref).hostname
  } catch {
    // Not a full URL: match against the raw string below
  }
  for (const [re, name] of HOSTS) if (re.test(host)) return name
  // Our own domain (shared room links) counts as direct, not a new source
  if (/first-date\.app|localhost/i.test(host)) return 'direct'
  return 'other'
}

/** Arabic label for a source, for the admin funnel. */
export const SOURCE_LABEL: Record<string, string> = {
  instagram: 'إنستغرام',
  facebook: 'فيسبوك',
  tiktok: 'تيك توك',
  snapchat: 'سناب شات',
  whatsapp: 'واتساب',
  telegram: 'تيليغرام',
  google: 'قوقل',
  youtube: 'يوتيوب',
  twitter: 'تويتر / X',
  direct: 'مباشر',
  other: 'أخرى',
  unknown: 'ماعرفناش',
}
