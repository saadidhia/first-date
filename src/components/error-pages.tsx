import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="glow-bg grid min-h-svh place-items-center px-6 py-16">
      <div className="max-w-md space-y-6 text-center">
        <p className="font-display text-6xl font-bold text-love" dir="ltr">
          404
        </p>
        <h1 className="font-display text-3xl font-bold">
          الصفحة هذي ما فمّاهاش
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          يمكن الرابط غالط ولا الصفحة تنحّات. ارجع للصفحة الرئيسية وابدا من
          جديد.
        </p>
        <Button asChild className="btn-love h-12 rounded-xl px-6 font-semibold">
          <Link to="/">الصفحة الرئيسية</Link>
        </Button>
      </div>
    </main>
  )
}

export function RouteErrorPage({ reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <main className="glow-bg grid min-h-svh place-items-center px-6 py-16">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="font-display text-3xl font-bold">
          الصفحة ما تحلّتش
        </h1>
        <p role="alert" className="leading-relaxed text-muted-foreground">
          صار مشكل صغير. عاود جرّب، ولا ارجع للصفحة الرئيسية.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            className="btn-love h-12 rounded-xl px-6 font-semibold"
            onClick={() => {
              void router.invalidate()
              reset()
            }}
          >
            عاود جرّب
          </Button>
          <Button variant="outline" asChild className="h-12 rounded-xl px-6">
            <a href="/">الصفحة الرئيسية</a>
          </Button>
        </div>
      </div>
    </main>
  )
}
