import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Headphones, Mic, MicOff, Radio } from 'lucide-react'

import { AdminShell } from '@/components/admin-shell'
import { type LiveRoom, getAdminLive } from '@/lib/admin.functions'
import { useListen } from '@/lib/use-listen'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin_/live')({
  head: () => ({
    meta: [
      { title: 'المكالمات — First Date' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: LivePage,
})

const MODE_EMOJI = { date: '💘', friends: '🤝' }

function LivePage() {
  return (
    <AdminShell>
      <LiveList />
    </AdminShell>
  )
}

/** The rooms with someone in a call right now; the admin listens to any of them from here. */
function LiveList() {
  const [rooms, setRooms] = useState<LiveRoom[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    const load = () =>
      getAdminLive()
        .then((r) => {
          if (stop) return
          setRooms(r)
          setError(null)
        })
        .catch((e) => !stop && setError(e instanceof Error ? e.message : 'مشكل'))
    load()
    const id = window.setInterval(() => !document.hidden && load(), 2000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <div className="mt-8">
      <h1 className="font-display text-3xl font-bold">شكون يحكي توّا</h1>
      <p className="mt-1 text-sm text-muted-foreground">اللاعبين اللي في مكالمة توّا. انزل على «اسمع» باش تسمع اللعبة.</p>

      <section className="mt-6 rounded-3xl border border-border bg-card/85 p-5">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!rooms ? (
          <p className="text-sm text-muted-foreground">لحظة…</p>
        ) : rooms.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="size-4" /> حتى حد ما هو في مكالمة توّا.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rooms.map((room) => (
              <RoomRow key={room.code} room={room} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function RoomRow({ room }: { room: LiveRoom }) {
  const listen = useListen(room.code)
  const open = room.members.filter((m) => !m.muted)
  const heard = open.filter((m) => listen.connected.includes(m.id))

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {room.members.map((m) => {
            const mic = !m.muted
            const emoji = m.gender === 'female' ? '👩' : m.gender === 'male' ? '👨' : '👤'
            return (
              <span
                key={m.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all',
                  mic && m.speaking
                    ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200 shadow-[0_0_10px] shadow-emerald-400/40'
                    : 'border-border bg-background/50',
                )}
              >
                <span className="truncate font-semibold">
                  {emoji} {m.name}
                </span>
                {mic ? (
                  <Mic className={cn('size-3.5 shrink-0 text-emerald-400', m.speaking && 'animate-pulse')} />
                ) : (
                  <MicOff className="size-3.5 shrink-0 text-destructive" />
                )}
              </span>
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {MODE_EMOJI[room.mode]} لعبة <span dir="ltr" className="font-mono">{room.code}</span> ·{' '}
          {open.length > 0 ? `${open.length} ميكرو محلول` : 'حتى ميكرو ما هو محلول'}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {listen.on && (
          <span className="text-muted-foreground">
            {open.length === 0
              ? 'حتى ميكرو ما هو محلول'
              : heard.length === open.length
                ? `تسمع ${heard.map((m) => m.name).join(' و ')}`
                : 'يتّصل…'}
          </span>
        )}
        {listen.error && <span className="text-destructive">{listen.error}</span>}
        <button
          type="button"
          onClick={listen.on ? listen.stop : listen.start}
          className={cn(
            'flex items-center gap-1 rounded-full border px-3 py-1.5 font-semibold transition-colors',
            listen.on
              ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200 shadow-[0_0_10px] shadow-emerald-400/40'
              : 'border-border bg-background/50 hover:bg-muted',
          )}
        >
          <Headphones className={cn('size-3.5', listen.on && 'animate-pulse')} />
          {listen.on ? 'وقّف السماع' : 'اسمع'}
        </button>
      </div>
    </li>
  )
}
