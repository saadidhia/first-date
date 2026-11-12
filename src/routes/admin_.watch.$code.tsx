import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Check, Eye } from 'lucide-react'

import { AdminShell } from '@/components/admin-shell'
import { getAdminRoom } from '@/lib/admin.functions'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin_/watch/$code')({
  head: () => ({
    meta: [
      { title: 'تفرّج — First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: WatchPage,
})

type Room = Awaited<ReturnType<typeof getAdminRoom>>
type ChatRoom = Extract<NonNullable<Room>, { kind: 'chat' }>
type BoardRoomView = Extract<NonNullable<Room>, { kind: 'board' }>

const PHASE: Record<string, string> = {
  waiting: 'يستنّاو',
  intro: 'بداية',
  spin: 'العجلة',
  spinning: 'العجلة',
  question: 'يجاوبو',
  reveal: 'كشف الأجوبة',
  board: 'يلعبو',
  done: 'كمّلو',
}

function WatchPage() {
  return (
    <AdminShell>
      <Watcher />
    </AdminShell>
  )
}

/** Read-only live view of one room, refreshed often. The admin never appears to the players. */
function Watcher() {
  const { code } = Route.useParams()
  const [room, setRoom] = useState<Room | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let stop = false
    const load = () =>
      getAdminRoom({ data: { code } })
        .then((r) => {
          if (stop) return
          setRoom(r)
          setError(null)
        })
        .catch((e) => !stop && setError(e instanceof Error ? e.message : 'مشكل'))
    load()
    const id = window.setInterval(() => !document.hidden && load(), 1500)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [code])

  // Keep the chat scrolled to the newest revealed answers
  const chatLen = room?.kind === 'chat' ? room.history.length : 0
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [chatLen, room?.kind])

  return (
    <div className="mt-8">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" /> رجوع للوحة
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">
          تفرّج على اللعبة <span dir="ltr" className="font-mono">{code}</span>
        </h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
          <Eye className="size-3.5" /> متفرّج · اللاعبين ما يشوفوكش
        </span>
      </div>

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
      {room === undefined ? (
        <p className="mt-6 text-muted-foreground">لحظة…</p>
      ) : room === null ? (
        <p className="mt-6 text-muted-foreground">ما لقيناش لعبة بالكود هذا.</p>
      ) : (
        <>
          <Players players={room.players} />
          <p className="mt-2 text-sm text-muted-foreground">
            الحالة: {PHASE[room.phase] ?? room.phase}
          </p>
          <div
            ref={scroller}
            className="mt-4 max-h-[70dvh] space-y-3 overflow-y-auto rounded-3xl border border-border bg-card/85 p-4"
          >
            {room.kind === 'chat' ? <ChatView room={room} /> : <BoardView room={room} />}
          </div>
        </>
      )}
    </div>
  )
}

function Players({ players }: { players: NonNullable<Room>['players'] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {players.map((p) => (
        <span
          key={p.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-sm"
        >
          {p.online && <span className="size-2 rounded-full bg-emerald-400" />}
          {p.gender === 'female' ? '👩' : p.gender === 'male' ? '👨' : '👤'} {p.name}
          {p.host && <span className="text-xs text-muted-foreground">(حلّ اللعبة)</span>}
        </span>
      ))}
      {players.length === 0 && (
        <span className="text-sm text-muted-foreground">ما دخل حد بعد.</span>
      )}
    </div>
  )
}

/* --------------------------------- Chat ---------------------------------- */

function ChatView({ room }: { room: ChatRoom }) {
  if (room.phase === 'waiting')
    return <p className="text-center text-sm text-muted-foreground">نستنّاو اللعبة تبدا…</p>
  return (
    <>
      {room.history.map((h) => (
        <div key={h.index} className="rounded-2xl bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">
            {h.category} · {h.index + 1}/{room.total}
          </div>
          <p className="mt-1 font-semibold leading-relaxed">{h.text}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {h.answers.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className="shrink-0 font-semibold">{a.name}:</span>
                <span className={a.text ? '' : 'text-muted-foreground'}>
                  {a.text ?? '⏱ ما جاوبش'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {room.current && (
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-3">
          <div className="text-xs text-gold">
            {room.current.category} · {room.current.index + 1}/{room.total} · {PHASE[room.phase]}
          </div>
          <p className="mt-1 font-semibold leading-relaxed">{room.current.text}</p>
          {room.current.options.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {room.current.options.map((o, i) => (
                <li key={i}>
                  {['أ', 'ب', 'ج'][i]}. {o}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {room.players.map((p) => (
              <span
                key={p.id}
                className={cn(
                  'rounded-full px-2 py-0.5',
                  room.current!.answered.includes(p.id)
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {room.current!.answered.includes(p.id) ? '✓' : '…'} {p.name}
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            الأجوبة يبانو كي يجاوبو الكل.
          </p>
        </div>
      )}
      {room.history.length === 0 && !room.current && (
        <p className="text-center text-sm text-muted-foreground">مازالو ما بداوش يجاوبو.</p>
      )}
    </>
  )
}

/* --------------------------------- Board --------------------------------- */

const MEDALS = ['👑', '🥈', '🥉', '🏅']

function BoardView({ room }: { room: BoardRoomView }) {
  const b = room.board
  const nameOf = (id: number) => room.players.find((p) => p.id === id)?.name ?? '؟'

  if (room.phase === 'waiting')
    return <p className="text-center text-sm text-muted-foreground">نستنّاو اللعبة تبدا…</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
          الدورة {b.turns}/{b.maxTurns}
        </span>
        {b.turnOf != null && (
          <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold">
            🎲 دور {nameOf(b.turnOf)}
          </span>
        )}
      </div>

      {/* Where everyone stands */}
      <ul className="space-y-1.5">
        {(b.team ? ['team'] : b.order.map(String)).map((key, i) => {
          const id = b.team ? null : b.order[i]
          const square = b.pos[key] ?? 0
          const place = id != null && b.result ? b.result.ranking.indexOf(nameOf(id)) + 1 : 0
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-center">
                {place ? (MEDALS[place - 1] ?? '🏅') : '🎲'}
              </span>
              <span className="flex-1 font-semibold">
                {b.team ? 'الكوبل' : nameOf(id!)}
              </span>
              <span className="tabular-nums text-muted-foreground">
                المربّع {square}/{b.last}
              </span>
            </li>
          )
        })}
      </ul>

      {/* The open question or dare */}
      {b.question && (
        <div className="rounded-2xl border border-gold/40 bg-gold/5 p-3">
          <div className="text-xs text-gold">
            {b.question.kind === 'dare'
              ? '🎤 تحدّي'
              : b.question.kind === 'fight'
                ? '⚡ عراك'
                : b.team
                  ? '💬 سؤال'
                  : `🗳️ صحاب ${b.question.byName} يحكمو`}
          </div>
          <p className="mt-1 font-semibold leading-relaxed">{b.question.text}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {b.question.options.map((o, i) => (
              <li key={i}>
                {['أ', 'ب', 'ج'][i]}. {o}
                {b.question!.moves && (
                  <span className="ms-1 tabular-nums" dir="ltr">
                    ({b.question!.moves![i] > 0 ? '+' : ''}
                    {b.question!.moves![i]})
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {b.question.answered.map((id) => (
              <span
                key={id}
                className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
              >
                <Check className="me-0.5 inline size-3" />
                {nameOf(id)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* The last result */}
      {b.reveal && !b.question && (
        <div className="rounded-2xl bg-muted/40 p-3 text-sm">
          <p className="font-semibold">
            {b.reveal.text}{' '}
            <span className="tabular-nums text-muted-foreground" dir="ltr">
              ({b.reveal.delta > 0 ? '+' : ''}
              {b.reveal.delta})
            </span>
          </p>
        </div>
      )}

      {/* The log */}
      {b.log.length > 0 && (
        <ul className="space-y-1 text-sm">
          {b.log.slice(0, 8).map((e, i) => (
            <li
              key={i}
              className={cn(
                'rounded-xl px-3 py-1.5',
                e.tone === 'good'
                  ? 'bg-emerald-500/10 text-emerald-200'
                  : e.tone === 'bad'
                    ? 'bg-destructive/10 text-red-200'
                    : 'bg-muted/40 text-muted-foreground',
              )}
            >
              {e.text}
            </li>
          ))}
        </ul>
      )}

      {b.result && (
        <p className="rounded-2xl bg-gold/10 p-3 text-center text-sm font-semibold text-gold">
          {b.team
            ? b.result.won
              ? `💍 وصلو للعرس في ${b.result.turns} دورة`
              : '😅 ما وصلوش للعرس'
            : `👑 ${b.result.ranking[0] ?? ''} ملك القعدة`}
        </p>
      )}
    </div>
  )
}
