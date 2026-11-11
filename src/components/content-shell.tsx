import { Link } from '@tanstack/react-router'

import { AdSenseScript } from '@/components/adsense'
import { Logo } from '@/components/logo'
import { TunisiaFlag } from '@/components/tunisia-flag'

/**
 * Layout for the reading pages (guides, about): header with the site links, the page,
 * and a footer. These are the pages where AdSense may show ads, so it loads the ad library.
 */
export function ContentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="glow-bg min-h-dvh px-4 py-5 sm:px-5">
      <AdSenseScript />
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/guides"
            className="rounded-full px-3 py-2 text-muted-foreground transition hover:text-foreground"
          >
            مقالات
          </Link>
          <Link
            to="/questions"
            className="hidden rounded-full px-3 py-2 text-muted-foreground transition hover:text-foreground sm:inline-block"
          >
            أسئلة
          </Link>
          <Link
            to="/about"
            className="hidden rounded-full px-3 py-2 text-muted-foreground transition hover:text-foreground sm:inline-block"
          >
            شكون إحنا
          </Link>
          <Link
            to="/"
            hash="start"
            className="btn-love rounded-full px-4 py-2 font-medium"
          >
            العب توّا
          </Link>
        </nav>
      </header>

      <main className="mx-auto mt-10 max-w-3xl pb-16">{children}</main>

      <SiteFooter />
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <TunisiaFlag className="h-3.5 w-auto" />
        <span dir="ltr">First Date</span> على الطريقة التونسية · صنعت في تونس
        بالحب
      </span>
      <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        <Link to="/guides" className="underline hover:text-foreground">
          مقالات ونصائح
        </Link>
        <Link to="/questions" className="underline hover:text-foreground">
          بنك الأسئلة
        </Link>
        <Link to="/about" className="underline hover:text-foreground">
          شكون إحنا
        </Link>
        <Link to="/privacy" className="underline hover:text-foreground">
          سياسة الخصوصية
        </Link>
        <Link to="/terms" className="underline hover:text-foreground">
          شروط الاستعمال
        </Link>
        <Link to="/sir" className="underline hover:text-foreground">
          اتّصل بينا
        </Link>
      </nav>
    </footer>
  )
}
