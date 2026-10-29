// A rewarded ad: the player watches a short ad and their report unlocks. This uses Google's
// H5 Games Ads (the Ad Placement API) — the only Google product that does "watch an ad to get a
// reward" on the web. Plain AdSense only shows passive banners and can't do this.
//
// It needs a Google Ad Manager / AdSense-for-games publisher id in VITE_ADSENSE_CLIENT
// (e.g. "ca-pub-1234567890123456"). Without it — or when no ad is available (ad blocker, an
// in-app browser like Instagram, no fill) — showRewardedAd resolves to 'skipped' and the caller
// reveals the report anyway, so a player is never trapped behind a broken ad.

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT

type AdBreakFn = (o: Record<string, unknown>) => void

declare global {
  interface Window {
    adsbygoogle?: unknown[]
    adBreak?: AdBreakFn
    adConfig?: AdBreakFn
  }
}

/** Whether the rewarded-ad gate is turned on (a publisher id is configured). */
export const rewardedAdsEnabled = !!CLIENT

let sdk: Promise<boolean> | null = null

function loadSdk(): Promise<boolean> {
  if (!CLIENT || typeof window === 'undefined') return Promise.resolve(false)
  if (sdk) return sdk
  sdk = new Promise<boolean>((resolve) => {
    const s = document.createElement('script')
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`
    s.async = true
    s.crossOrigin = 'anonymous'
    // Test ads while developing, so there's something to watch without a live, approved account
    if (import.meta.env.DEV) s.setAttribute('data-adbreak-test', 'on')
    s.onload = () => {
      window.adsbygoogle = window.adsbygoogle || []
      window.adBreak = window.adConfig = (o) => window.adsbygoogle!.push(o)
      try {
        window.adConfig!({ preloadAdBreaks: 'on', sound: 'on' })
      } catch {
        // The ad setup can throw on blocked networks; the ad call below then just skips
      }
      resolve(true)
    }
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
  return sdk
}

/**
 * Shows a rewarded ad. Resolves 'rewarded' only once the player has watched it to the end,
 * and 'skipped' in every other case (no ad available, closed early, blocked, or not configured).
 */
export async function showRewardedAd(
  name: string,
): Promise<'rewarded' | 'skipped'> {
  const adBreak = (await loadSdk()) ? window.adBreak : undefined
  if (!adBreak) return 'skipped'
  return new Promise<'rewarded' | 'skipped'>((resolve) => {
    let rewarded = false
    let settled = false
    const done = (r: 'rewarded' | 'skipped') => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve(r)
    }
    // If the SDK never calls back (silently blocked), don't leave the player waiting forever
    const timer = window.setTimeout(() => done('skipped'), 12_000)
    try {
      adBreak({
        type: 'reward',
        name,
        beforeReward: (showAd: () => void) => showAd(),
        adViewed: () => {
          rewarded = true
        },
        adBreakDone: () => done(rewarded ? 'rewarded' : 'skipped'),
      })
    } catch {
      done('skipped')
    }
  })
}
