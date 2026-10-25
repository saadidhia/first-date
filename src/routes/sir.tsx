import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Send } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { sendSecretMessage } from '@/lib/secret.functions'

export const Route = createFileRoute('/sir')({
  head: () => ({
    meta: [
      { title: 'ابعثلي رسالة سرّية 🤫' },
      { name: 'description', content: 'اكتبلي اللي في قلبك، الرسالة توصلني أنا برك.' },
      { property: 'og:title', content: 'ابعثلي رسالة سرّية 🤫' },
      { property: 'og:description', content: 'اكتبلي اللي في قلبك، الرسالة توصلني أنا برك.' },
      { property: 'og:image', content: '/wedding-hero.webp' },
    ],
  }),
  component: SecretPage,
})

// Zod errors come back as a JSON list in the message; show the first one
function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : ''
  try {
    const list = JSON.parse(msg)
    if (Array.isArray(list) && list[0]?.message) return String(list[0].message)
  } catch {
    // Plain message
  }
  return msg || 'صار مشكل، عاود جرّب'
}

function SecretPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    setBusy(true)
    setError(null)
    try {
      await sendSecretMessage({
        data: {
          body: String(f.get('body') ?? ''),
          website: String(f.get('website') ?? ''),
        },
      })
      form.reset()
      setSent(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glow-bg zellige min-h-dvh px-5 py-6">
      <header className="mx-auto flex max-w-md items-center justify-between">
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto mt-10 max-w-md">
        <div className="text-center">
          <div className="text-5xl">🤫</div>
          <h1 className="mt-3 font-display text-3xl font-bold">
            ابعثلي <span className="text-love">رسالة سرّية</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            قول اللي في قلبك. الرسالة توصلني أنا برك، وما يشوفها حتى حد آخر.
          </p>
        </div>

        {sent ? (
          <div className="pop-in mt-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <div className="text-4xl">💌</div>
            <p className="mt-2 font-display text-xl font-semibold">وصلت الرسالة!</p>
            <Button variant="secondary" className="mt-4 rounded-xl" onClick={() => setSent(false)}>
              ابعث رسالة أخرى
            </Button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="surface mt-8 space-y-3 rounded-3xl p-5"
          >
            <Textarea
              name="body"
              required
              maxLength={1000}
              rows={5}
              placeholder="اكتب رسالتك هوني…"
              className="min-h-32 rounded-2xl text-base"
            />
            {/* Honeypot: hidden from people, bots fill it in */}
            <Input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="btn-love h-12 w-full rounded-xl font-semibold">
              {busy ? 'لحظة…' : 'ابعث'} <Send className="size-4 -scale-x-100" />
            </Button>
          </form>
        )}
      </main>
    </div>
  )
}
