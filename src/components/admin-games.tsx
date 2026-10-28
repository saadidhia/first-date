import { useEffect, useState } from 'react'
import { Headphones, Mic, MicOff } from 'lucide-react'

import { type AdminGame, getAdminVoice } from '@/lib/admin.functions'
import { useListen } from '@/lib/use-listen'
import { cn } from '@/lib/utils'

// Couples (First Date) are linked in pink, friends (صحاب) in blue
const LINE = { date: 'bg-pink-400', friends: 'bg-sidi-blue' }
const MODE_EMOJI = { date: '💘', friends: '🤝' }

const PHASE_LABEL: Record<string, string> = {
  waiting: 'يستنّاو',
  intro: 'بداية',
  spin: 'العجلة',
  spinning: 'العجلة',
  question: 'يجاوبو',
  reveal: 'يجاوبو',
  done: 'كمّلو',
}

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `قبل ${s} ثانية`
  const m = Math.round(s / 60)
  if (m < 60) return `قبل ${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return `قبل ${h} ساعة`
  return new Date(iso).toLocaleDateString('ar-TN', { day: 'numeric', month: 'short' })
}

type MicState = { muted: boolean; speaking: boolean }
export type VoiceMap = Map<number, MicState>

/** Who is in a voice call right now, by player id, refreshed every 2 seconds. */
export function useAdminVoice(): VoiceMap {
  const [voice, setVoice] = useState<VoiceMap>(new Map())
  useEffect(() => {
    let stop = false
    const load = () =>
      getAdminVoice()
        .then((rows) => !stop && setVoice(new Map(rows.map((r) => [r.id, r]))))
        .catch(() => {})
    load()
    const id = window.setInterval(() => !document.hidden && load(), 2000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [])
  return voice
}

export function PairLegend() {
  return (
    <div className="flex gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className={cn('h-0.5 w-5 rounded-full', LINE.date)} /> كوبل (First Date)
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn('h-0.5 w-5 rounded-full', LINE.friends)} /> صحاب
      </span>
    </div>
  )
}

/**
 * One game: its players linked by a pink (couple) or blue (friends) line. A friends group of
 * 3 or more shows everyone in a row, each linked to the next.
 */
export function GameRow({ game, voice }: { game: AdminGame; voice: VoiceMap }) {
  const [host, ...guests] = game.players
  const progress = game.phase === 'done' ? game.questions : Math.min(game.currentIndex, game.questions)
  return (
    <li className="py-3">
      {guests.length > 1 ? (
        <div className="flex flex-wrap items-center gap-y-2">
          {game.players.map((p, i) => (
            <div key={p.id} className="flex min-w-0 items-center">
              {i > 0 && <span className={cn('h-0.5 w-5 shrink-0 rounded-full', LINE[game.mode])} aria-hidden />}
              <PlayerChip player={p} mode={game.mode} mic={voice.get(p.id)} className="max-w-36" />
            </div>
          ))}
          <span className="ms-2 text-xs text-muted-foreground">{MODE_EMOJI[game.mode]} {game.players.length}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {host && <PlayerChip player={host} mode={game.mode} mic={voice.get(host.id)} />}
          <div className="relative flex min-w-8 flex-1 items-center" aria-hidden>
            <span
              className={cn(
                'w-full rounded-full',
                guests[0] ? cn('h-0.5', LINE[game.mode]) : 'h-0 border-t-2 border-dashed border-muted-foreground/40',
              )}
            />
            <span className="absolute inset-x-0 mx-auto w-fit rounded-full bg-card px-1 text-xs">
              {MODE_EMOJI[game.mode]}
            </span>
          </div>
          {guests[0] ? (
            <PlayerChip player={guests[0]} mode={game.mode} mic={voice.get(guests[0].id)} />
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">ما دخل حد</span>
          )}
        </div>
      )}
      {game.match && <MatchLine match={game.match} mode={game.mode} group={guests.length > 1} />}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          لعبة <span dir="ltr" className="font-mono">{game.code}</span> · {PHASE_LABEL[game.phase] ?? game.phase}
          {guests.length > 0 && game.phase !== 'waiting' && ` · سؤال ${progress}/${game.questions}`} · بدات {timeAgo(game.createdAt)}
        </p>
        <ListenButton game={game} voice={voice} />
      </div>
    </li>
  )
}

/**
 * Listens to the game's voice call: everyone whose mic is on is heard at the same time.
 * Shown while someone is in the call (and while listening, to stop).
 */
function ListenButton({ game, voice }: { game: AdminGame; voice: VoiceMap }) {
  const listen = useListen(game.code)
  const inCall = game.players.filter((p) => voice.has(p.id))
  if (!listen.on && inCall.length === 0) return listen.error ? <span className="text-xs text-destructive">{listen.error}</span> : null

  const open = inCall.filter((p) => !voice.get(p.id)!.muted)
  const heard = open.filter((p) => listen.connected.includes(p.id))
  return (
    <div className="flex items-center gap-2 text-xs">
      {listen.on && (
        <span className="text-muted-foreground">
          {open.length === 0
            ? 'حتى ميكرو ما هو محلول'
            : heard.length === open.length
              ? `تسمع ${heard.map((p) => p.name).join(' و ')}`
              : 'يتّصل…'}
        </span>
      )}
      {listen.error && <span className="text-destructive">{listen.error}</span>}
      <button
        type="button"
        onClick={listen.on ? listen.stop : listen.start}
        className={cn(
          'flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition-colors',
          listen.on
            ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200 shadow-[0_0_10px] shadow-emerald-400/40'
            : 'border-border bg-background/50 hover:bg-muted',
        )}
      >
        <Headphones className={cn('size-3.5', listen.on && 'animate-pulse')} />
        {listen.on ? 'وقّف السماع' : 'اسمع'}
      </button>
    </div>
  )
}

export const matchWord = (score: number) =>
  score >= 80 ? '🔥 توافق كبير' : score >= 65 ? '👍 باهي' : score >= 50 ? '🤔 يمشي' : '😬 صعيب'

/** How well they match: the couple's score, or a group's average and its closest pair. */
function MatchLine({
  match,
  mode,
  group,
}: {
  match: NonNullable<AdminGame['match']>
  mode: AdminGame['mode']
  group: boolean
}) {
  const best = match.pairs[0]
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span
        className={cn(
          'rounded-full px-2 py-0.5 font-semibold tabular-nums',
          mode === 'date' ? 'bg-pink-400/15 text-pink-300' : 'bg-sidi-blue/15 text-sidi-blue',
        )}
      >
        {MODE_EMOJI[mode]} {group ? 'متوسّط التوافق' : 'التوافق'} {match.score}%
      </span>
      <span className="text-muted-foreground">{matchWord(match.score)}</span>
      {group && best && (
        <span className="text-muted-foreground">
          أقرب زوز: {best.a} و{best.b} <span className="tabular-nums">{best.score}%</span>
        </span>
      )}
    </div>
  )
}

function PlayerChip({
  player,
  mode,
  mic,
  className = 'max-w-[40%]',
}: {
  player: AdminGame['players'][number]
  mode: AdminGame['mode']
  // Their voice call state; undefined when they are not in the call
  mic?: MicState
  className?: string
}) {
  const open = !!mic && !mic.muted
  const emoji =
    player.gender === 'female' ? (mode === 'date' ? '👰' : '👩') : player.gender === 'male' ? (mode === 'date' ? '🤵' : '👨') : '👤'
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-full border bg-background/50 px-2.5 py-1 text-sm',
        open && mic.speaking ? 'border-emerald-400 bg-emerald-400/10' : 'border-border',
        className,
      )}
      title={player.online ? 'en ligne توّا' : `آخر مرّة ${timeAgo(player.lastSeenAt)}`}
    >
      <span
        className={cn('size-2 shrink-0 rounded-full', player.online ? 'bg-emerald-400' : 'bg-muted-foreground/40')}
      />
      <span className="truncate font-semibold">
        {emoji} {player.name}
      </span>
      {open ? (
        <Mic
          className={cn('size-3.5 shrink-0 text-emerald-400', mic.speaking && 'animate-pulse')}
          aria-label={mic.speaking ? 'يحكي توّا' : 'الميكرو محلول'}
        />
      ) : (
        <MicOff
          className={cn('size-3.5 shrink-0', mic ? 'text-destructive' : 'text-muted-foreground/40')}
          aria-label={mic ? 'سكّر الميكرو' : 'الميكرو مسكّر'}
        />
      )}
    </span>
  )
}
