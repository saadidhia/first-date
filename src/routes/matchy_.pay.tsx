import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Coins, Loader2 } from 'lucide-react'

import { Logo } from '@/components/logo'
import { confirmCoinPurchase } from '@/lib/coins.functions'

export const Route = createFileRoute('/matchy_/pay')({
  head: () => ({ meta: [{ title: 'الدفع · ماتشي' }] }),
  component: PayPage,
})

type Result = Awaited<ReturnType<typeof confirmCoinPurchase>>

function PayPage() {
  const [state, setState] = useState<Result | 'loading' | 'error'>('loading')

  const check = useCallback(async () => {
    const t =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('t')
        : null
    if (!t) return setState('error')
    setState('loading')
    try {
      setState(await confirmCoinPurchase({ data: { t } }))
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(check, 0)
    return () => window.clearTimeout(id)
  }, [check])

  return (
    <div className="glow-bg grid min-h-dvh place-items-center px-5">
      <div className="surface w-full max-w-sm rounded-3xl p-6 text-center">
        <div className="mb-4 flex justify-center">
          <Logo />
        </div>

        {state === 'loading' && (
          <div className="py-6">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              نأكّدو الدفع…
            </p>
          </div>
        )}

        {state === 'error' && (
          <>
            <div className="text-4xl">⚠️</div>
            <p className="mt-2 font-semibold">ما لقيناش الدفع</p>
            <BackButton />
          </>
        )}

        {typeof state === 'object' && state.status === 'paid' && (
          <>
            <div className="text-5xl">🎉</div>
            <p className="mt-2 text-lg font-bold">تشحن رصيدك!</p>
            {state.added != null && (
              <p className="mt-1 text-sm text-muted-foreground">
                زدنالك {state.added} كوان
              </p>
            )}
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-4 py-2 font-bold text-gold">
              <Coins className="size-4" />
              <span className="tabular-nums">{state.coins}</span> كوان
            </div>
            <BackButton label="ارجع للّوبي" />
          </>
        )}

        {typeof state === 'object' && state.status === 'pending' && (
          <>
            <div className="text-4xl">⏳</div>
            <p className="mt-2 font-semibold">مازال نستنّاو تأكيد الدفع</p>
            <p className="mt-1 text-xs text-muted-foreground">
              إذا خلّصت، استنّى ثوانٍ وعاود تحقّق
            </p>
            <button
              type="button"
              onClick={check}
              className="btn-love mt-4 w-full rounded-xl py-2.5 text-white"
            >
              تحقّق مرّة أخرى
            </button>
            <BackButton />
          </>
        )}

        {typeof state === 'object' && state.status === 'failed' && (
          <>
            <div className="text-4xl">❌</div>
            <p className="mt-2 font-semibold">الدفع ما نجحش</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ما تنحّى منّك حتى شي. تنجّم تعاود.
            </p>
            <BackButton label="ارجع وعاود" />
          </>
        )}
      </div>
    </div>
  )
}

function BackButton({ label = 'رجوع للّوبي' }: { label?: string }) {
  return (
    <Link
      to="/matchy"
      className="mt-4 block w-full rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted"
    >
      {label}
    </Link>
  )
}
