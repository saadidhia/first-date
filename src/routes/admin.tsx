import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Copy, MessageCircleHeart, Share2, Trash2 } from 'lucide-react'

import { AdminShell } from '@/components/admin-shell'
import { Button } from '@/components/ui/button'
import {
  deleteSecretMessage,
  getSecretMessages,
  markSecretMessagesRead,
} from '@/lib/secret.functions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'لوحة الإدارة — First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AdminPage,
})

function AdminPage() {
  return (
    <AdminShell>
      <SecretInbox />
    </AdminShell>
  )
}

type SecretMessage = Awaited<ReturnType<typeof getSecretMessages>>[number]

/** The public /sir link to share (e.g. as a link sticker in an Instagram story) and the messages it got. */
function SecretInbox() {
  const [messages, setMessages] = useState<SecretMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [link, setLink] = useState('')

  useEffect(() => {
    setLink(`${window.location.origin}/sir`)
    let stop = false
    const load = () =>
      getSecretMessages()
        .then((m) => {
          if (stop) return
          setMessages(m)
          setError(null)
        })
        .catch((e) => !stop && setError(e instanceof Error ? e.message : 'مشكل'))
    load()
    const id = window.setInterval(() => !document.hidden && load(), 30_000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [])

  const unread = messages?.filter((m) => m.unread).length ?? 0

  async function copy() {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: 'ابعثلي رسالة سرّية 🤫', url: link }).catch(() => {})
    } else {
      await copy()
    }
  }

  async function markRead() {
    await markSecretMessagesRead().catch(() => {})
    setMessages((list) => list?.map((m) => ({ ...m, unread: false })) ?? null)
  }

  async function remove(id: number) {
    if (!window.confirm('تفسخ الرسالة هذي؟')) return
    await deleteSecretMessage({ data: { id } })
      .then(() => setMessages((list) => list?.filter((m) => m.id !== id) ?? null))
      .catch(() => setError('ما نجمناش نفسخو الرسالة'))
  }

  return (
    <section className="mt-8 rounded-3xl border border-primary/30 bg-card/85 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircleHeart className="size-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">الرسائل السرّية</h2>
        {unread > 0 && (
          <span className="bg-love rounded-full px-2 py-0.5 text-xs font-bold text-white">
            {unread} جديدة
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        حطّ الرابط هذا في ستوري إنستا (sticker «Lien») ولا في أي بلاصة. اللي يكتبلك يحطّ اسم حسابو في
        إنستا، ويتقالو إنّك تشوفو.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2.5 text-sm">
          {link || '…/sir'}
        </code>
        <Button variant="secondary" className="rounded-xl" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'تنسخ' : 'انسخ'}
        </Button>
        <Button className="btn-love rounded-xl" onClick={share}>
          <Share2 className="size-4" /> برتاجي
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {messages && messages.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">مازال حتى رسالة. برتاجي الرابط 😉</p>
      )}
      {messages && messages.length > 0 && (
        <>
          {unread > 0 && (
            <button
              type="button"
              onClick={markRead}
              className="mt-4 text-xs text-muted-foreground hover:text-foreground"
            >
              علّم الكل مقروء
            </button>
          )}
          <ul className="mt-2 space-y-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  'rounded-2xl border p-3',
                  m.unread ? 'border-primary/40 bg-primary/10' : 'border-border bg-background/40',
                )}
              >
                <div className="flex items-center gap-2 text-xs">
                  {m.instagram ? (
                    <a
                      href={`https://instagram.com/${m.instagram}`}
                      target="_blank"
                      rel="noreferrer"
                      dir="ltr"
                      className="font-semibold text-gold hover:underline"
                    >
                      @{m.instagram}
                    </a>
                  ) : (
                    <span className="font-semibold text-gold">مجهول{m.source ? ` · من ${m.source}` : ''}</span>
                  )}
                  <span className="text-muted-foreground">· {new Date(m.createdAt).toLocaleString('ar-TN')}</span>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="ms-auto text-muted-foreground hover:text-destructive"
                    aria-label="افسخ"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
