import type { AdminGame } from '@/lib/admin.functions'
import { cn } from '@/lib/utils'

// Couples (First Date) are linked in pink, friends (صحاب) in blue
const LINE = { date: 'bg-pink-400', friends: 'bg-sidi-blue' }
const MODE_EMOJI = { date: '💘', friends: '🤝' }

const PHASE_LABEL: Record<string, string> = {
  waiting: 'يستنّى الطرف الآخر',
  intro: 'بداية',
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

/** One game: the two players linked by a pink (couple) or blue (friends) line. */
export function GameRow({ game }: { game: AdminGame }) {
  const progress = game.phase === 'done' ? game.questions : Math.min(game.currentIndex, game.questions)
  return (
    <li className="py-3">
      <div className="flex items-center gap-2">
        <PlayerChip player={game.host} mode={game.mode} />
        <div className="relative flex min-w-8 flex-1 items-center" aria-hidden>
          <span
            className={cn(
              'w-full rounded-full',
              game.guest ? cn('h-0.5', LINE[game.mode]) : 'h-0 border-t-2 border-dashed border-muted-foreground/40',
            )}
          />
          <span className="absolute inset-x-0 mx-auto w-fit rounded-full bg-card px-1 text-xs">
            {MODE_EMOJI[game.mode]}
          </span>
        </div>
        {game.guest ? (
          <PlayerChip player={game.guest} mode={game.mode} />
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">ما دخل حد</span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        لعبة <span dir="ltr" className="font-mono">{game.code}</span> · {PHASE_LABEL[game.phase] ?? game.phase}
        {game.guest && game.phase !== 'waiting' && ` · سؤال ${progress}/${game.questions}`} · بدات {timeAgo(game.createdAt)}
      </p>
    </li>
  )
}

function PlayerChip({ player, mode }: { player: NonNullable<AdminGame['guest']>; mode: AdminGame['mode'] }) {
  const emoji =
    player.gender === 'female' ? (mode === 'date' ? '👰' : '👩') : player.gender === 'male' ? (mode === 'date' ? '🤵' : '👨') : '👤'
  return (
    <span
      className="flex min-w-0 max-w-[40%] items-center gap-1.5 rounded-full border border-border bg-background/50 px-2.5 py-1 text-sm"
      title={player.online ? 'en ligne توّا' : `آخر مرّة ${timeAgo(player.lastSeenAt)}`}
    >
      <span
        className={cn('size-2 shrink-0 rounded-full', player.online ? 'bg-emerald-400' : 'bg-muted-foreground/40')}
      />
      <span className="truncate font-semibold">
        {emoji} {player.name}
      </span>
    </span>
  )
}
