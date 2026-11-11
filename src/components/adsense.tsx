/** Our AdSense publisher id (also in public/ads.txt and the verification meta tag in __root.tsx). */
export const ADSENSE_CLIENT = 'ca-pub-8012328178199762'

/**
 * Loads the AdSense library, which lets Auto ads place ads on the page.
 *
 * Only render it on pages with real reading content (home, guides, about, privacy). AdSense
 * policy forbids ads on screens without publisher content, so never put it on the game
 * screens (room, AI chat), forms (/sir), admin or error pages. Site ownership is verified by
 * the meta tag in __root.tsx, so this doesn't have to load everywhere.
 *
 * React 19 hoists an async script into <head> and loads it once, even if several pages render it.
 */
export function AdSenseScript() {
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
    />
  )
}
