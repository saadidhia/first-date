import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Send } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { getConversation, sendChat } from '@/lib/chat.functions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/matchy_/chat/$username')({
  head: () => ({
    meta: [{ title: 'دردشة · ماتشي' }],
  }),
  component: ChatPage,
})

type Conversation = Awaited<ReturnType<typeof getConversation>>

function ChatPage() {
  const { username } = Route.useParams()
  const navigate = useNavigate()
  const [convo, setConvo] = useState<Conversation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    try {
      const c = await getConversation({ data: { username } })
      setConvo(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'مشكل')
    }
  }, [username])

  useEffect(() => {
    const first = window.setTimeout(refresh, 0)
    const id = window.setInterval(() => {
      if (!document.hidden) refresh()
    }, 4000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [refresh])

  const count = convo?.messages.length ?? 0
  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [count])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft('')
    try {
      const msg = await sendChat({ data: { username, body } })
      setConvo((c) =>
        c ? { ...c, messages: [...c.messages, msg] } : c,
      )
    } catch (err) {
      setDraft(body)
      setError(err instanceof Error ? err.message : 'ما تبعثش')
    } finally {
      setSending(false)
    }
  }

  if (error && !convo) {
    return (
      <div className="glow-bg grid min-h-dvh place-items-center px-5 text-center">
        <div>
          <p className="text-lg font-semibold">{error}</p>
          <button
            type="button"
            className="btn-love mt-6 rounded-xl px-5 py-2.5 text-white"
            onClick={() => navigate({ to: '/matchy' })}
          >
            رجوع للّوبي
          </button>
        </div>
      </div>
    )
  }

  const friend = convo?.friend
  return (
    <div className="glow-bg flex h-dvh justify-center md:p-6">
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background/95 md:rounded-[2rem] md:border md:border-border md:shadow-2xl md:shadow-primary/10">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border bg-card/80 px-3 py-2.5 backdrop-blur">
          <Link
            to="/matchy"
            className="grid size-9 place-items-center rounded-full text-primary hover:bg-muted"
            aria-label="رجوع"
          >
            <ArrowRight className="size-5" />
          </Link>
          <div
            className={cn(
              'grid size-10 place-items-center rounded-full font-display font-bold text-white',
              friend?.gender === 'female' ? 'bg-love' : 'bubble-friends',
            )}
          >
            {friend?.name?.[0] ?? '💬'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">
              {friend?.name ?? 'دردشة'}
              {friend?.age != null && (
                <span className="ms-1 text-xs font-normal text-muted-foreground">
                  · {friend.age}
                </span>
              )}
            </div>
            <div className="text-xs">
              {friend?.online ? (
                <span className="text-emerald-400">متّصل توّا</span>
              ) : (
                <span className="text-muted-foreground">موش متّصل</span>
              )}
            </div>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scroller}
          className="chat-wall flex-1 space-y-2 overflow-y-auto px-3 py-5 md:px-5"
        >
          {convo && convo.messages.length === 0 && (
            <div className="mx-auto max-w-xs rounded-2xl bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
              ولّيتو أصحاب 💘 ابدا الدردشة!
            </div>
          )}
          {convo?.messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex', m.mine ? 'justify-start' : 'justify-end')}
            >
              <div
                className={cn(
                  'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm',
                  m.mine
                    ? 'bubble-mine rounded-ss-sm text-white'
                    : 'rounded-se-sm bg-muted text-foreground',
                )}
              >
                {m.body}
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={send}
          className="flex items-center gap-2 border-t border-border bg-card/80 p-3 backdrop-blur"
        >
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="btn-love grid size-11 shrink-0 place-items-center rounded-full text-white disabled:opacity-50"
            aria-label="ابعث"
          >
            <Send className="size-5 -scale-x-100" />
          </button>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="اكتب رسالة…"
            maxLength={1000}
            className="flex-1"
          />
        </form>
      </div>
    </div>
  )
}
