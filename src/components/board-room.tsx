import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowRight, Check, Copy, Share2 } from 'lucide-react'

import { Confetti } from '@/components/confetti'
import { ShareResultButton } from '@/components/share-result'
import { RoomMusic } from '@/components/room-music'
import { SfxButton } from '@/components/sfx-toggle'
import { VoiceBar } from '@/components/voice-bar'
import { Button } from '@/components/ui/button'
import { EFFECT, boardSquares, squareFor, stepsWord } from '@/lib/board'
import { answerBoard, getBoardState, rollDice } from '@/lib/board.functions'
import { startRoom } from '@/lib/room.functions'
import type { ShareCardInput } from '@/lib/share-card'
import { playSfx } from '@/lib/sfx'
import { useVoice } from '@/lib/use-voice'
import { cn } from '@/lib/utils'

// ثنية العرس, the board game screen. The server owns the game (src/lib/board.ts); this page polls
// it, and stages each change: the dice tumbles, the pawns hop square by square, then the question
// card or the outcome shows.

type State = Awaited<ReturnType<typeof getBoardState>>
type Board = NonNullable<State['board']>

const DICE_MS = 900
/** Places at the throne, in order of arrival */
const MEDALS = ['👑', '🥈', '🥉', '🏅']
const HOP_MS = 260
const PAWN_COLORS = [
  'var(--primary)',
  'var(--gold)',
  'var(--sidi-blue)',
  'oklch(0.74 0.15 155)',
]
const g = (gender: string | null | undefined, m: string, f: string) =>
  gender === 'female' ? f : m

/** Centre of square i on a board 8 wide that snakes up from the bottom right (Arabic reads right to left). */
function cell(i: number) {
  const row = Math.floor(i / 8)
  const c = i % 8
  return { x: row % 2 === 0 ? 750 - c * 100 : 50 + c * 100, y: 550 - row * 100 }
}

function useBoardState(code: string, token: string) {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const kick = useRef<() => void>(() => {})
  const phase = useRef<string | null>(null)

  useEffect(() => {
    let stop = false
    let timer: number | undefined
    const tick = async () => {
      window.clearTimeout(timer)
      try {
        const s = await getBoardState({ data: { code, token } })
        if (stop) return
        setOffset(s.serverNow - Date.now())
        phase.current = s.phase
        setState(s)
        setError(null)
      } catch (err) {
        if (stop) return
        setError(
          err instanceof Error ? err.message : 'مشكل في الإنترنت، عاود جرّب',
        )
      } finally {
        const delay =
          phase.current === 'done'
            ? null
            : phase.current === 'waiting'
              ? 3000
              : 1200
        if (!stop && delay && !document.hidden)
          timer = window.setTimeout(tick, delay)
      }
    }
    const onVisible = () => {
      if (!document.hidden && phase.current !== 'done') tick()
    }
    kick.current = tick
    tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stop = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [code, token])

  const refresh = useCallback(() => kick.current(), [])
  return { state, error, offset, refresh }
}

/** A clock that ticks 10 times a second, for the staging and the countdowns. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/** The square a pawn shows, walking one square at a time towards `target`. */
function useStepper(target: number) {
  const [shown, setShown] = useState(target)
  useEffect(() => {
    if (shown === target) return
    const id = window.setTimeout(() => {
      setShown((s) => s + Math.sign(target - s))
      playSfx('hop')
    }, HOP_MS)
    return () => window.clearTimeout(id)
  }, [shown, target])
  return shown
}

export function BoardRoom({ code, token }: { code: string; token: string }) {
  const { state, error, offset, refresh } = useBoardState(code, token)
  const voice = useVoice(code, token)
  const now = useNow()
  const [busy, setBusy] = useState(false)
  const [rollAnim, setRollAnim] = useState<{ seq: number; at: number } | null>(
    null,
  )
  const [revealAnim, setRevealAnim] = useState<{
    seq: number
    at: number
  } | null>(null)
  const [confetti, setConfetti] = useState(0)
  const history = useBoardHistory(code, state)
  const [openSquare, setOpenSquare] = useState<number | null>(null)
  const seen = useRef<{ roll: number; reveal: number; done: boolean } | null>(
    null,
  )

  // Stage what changed since the last poll (nothing on the first load)
  useEffect(() => {
    const b = state?.board
    if (!b) return
    const prev = seen.current
    const cur = {
      roll: b.roll?.seq ?? 0,
      reveal: b.reveal?.seq ?? 0,
      done: b.step === 'done',
    }
    seen.current = cur
    if (!prev) return
    const t = Date.now()
    if (cur.roll !== prev.roll && b.roll) {
      setRollAnim({ seq: cur.roll, at: t })
      playSfx('dice')
    }
    if (cur.reveal !== prev.reveal && b.reveal) {
      setRevealAnim({ seq: cur.reveal, at: t })
      playSfx(b.reveal.matched ? 'match' : 'timeup')
    }
    if (cur.done && !prev.done && b.result?.won) {
      window.setTimeout(() => {
        playSfx('done')
        setConfetti(Date.now())
      }, 1600)
    }
  }, [state])

  const b = state?.board ?? null
  const rollAge =
    b?.roll && rollAnim?.seq === b.roll.seq ? now - rollAnim.at : Infinity
  const steps = b?.roll ? Math.abs(b.roll.to - b.roll.from) : 0
  const landMs = DICE_MS + steps * HOP_MS + 600
  const rolling = rollAge < DICE_MS
  const settled = rollAge >= landMs
  const questionVisible = !!b?.question && rollAge >= landMs - 500
  // After a question, the answers stay up until the server lets the next roll happen
  const holdLeft = b?.holdUntil
    ? Math.max(0, Math.ceil((b.holdUntil - (now + offset)) / 1000))
    : 0
  const revealVisible =
    !!b?.reveal &&
    (holdLeft > 0 ||
      (revealAnim?.seq === b.reveal.seq && now - revealAnim.at < 4200))

  const questionSeq = questionVisible ? b?.question?.seq : undefined
  useEffect(() => {
    if (questionSeq) playSfx('question')
  }, [questionSeq])

  // A couple's 🚧 obstacle shows as the pawns land on it, just before they slide back
  const obstacleVisible =
    !!b?.obstacle && rollAge >= landMs - 700 && rollAge < landMs + 3000
  useEffect(() => {
    if (obstacleVisible) playSfx('timeup')
  }, [obstacleVisible])

  if (error && !state) {
    return (
      <div className="glow-bg grid min-h-dvh place-items-center px-5 text-center">
        <div>
          <p className="text-lg font-semibold">{error}</p>
          <Button asChild className="btn-love mt-6 rounded-xl">
            <Link to="/">رجوع للصفحة الرئيسية</Link>
          </Button>
        </div>
      </div>
    )
  }
  if (!state) {
    return (
      <div className="glow-bg grid min-h-dvh place-items-center text-muted-foreground">
        نحضّرو اللوحة… 🎲
      </div>
    )
  }

  const friends = state.mode === 'board_friends'
  const order = b?.order ?? state.players.map((p) => p.id)
  const colorOf = (id: number) =>
    PAWN_COLORS[Math.max(0, order.indexOf(id)) % PAWN_COLORS.length]
  const byId = new Map(state.players.map((p) => [p.id, p]))
  const left = b
    ? Math.max(0, Math.ceil((b.endsAt - (now + offset)) / 1000))
    : 0

  /** Where a pawn should stand right now: before the dice lands, where it was; then the square it rolled to; then where it ended up. */
  const targetFor = (key: string) => {
    if (!b) return 0
    const actual = b.pos[key] ?? 0
    if (!b.roll || settled) return actual
    const rk = b.team ? 'team' : String(b.roll.by)
    if (rk !== key) return actual
    return rolling ? b.roll.from : b.roll.to
  }

  async function roll() {
    if (busy) return
    setBusy(true)
    try {
      await rollDice({ data: { code, token } })
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل، عاود جرّب')
    } finally {
      setBusy(false)
    }
  }

  async function answer(option: number) {
    if (!b?.question || busy) return
    setBusy(true)
    try {
      await answerBoard({ data: { code, token, seq: b.question.seq, option } })
      playSfx('reaction')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل، عاود جرّب')
    } finally {
      setBusy(false)
    }
  }

  const myTurn = b?.step === 'roll' && b.turnOf === state.me.id
  const turnPlayer = b?.turnOf != null ? byId.get(b.turnOf) : undefined

  return (
    <div className="glow-bg flex h-dvh justify-center md:p-6">
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background/95 md:rounded-[2rem] md:border md:border-border md:shadow-2xl md:shadow-primary/10">
        <header className="border-b border-border bg-card/80 px-3 pb-2 pt-2.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid size-9 place-items-center rounded-full text-primary hover:bg-muted"
              aria-label="رجوع"
            >
              <ArrowRight className="size-5" />
            </Link>
            <div className="bubble-gold grid size-10 place-items-center rounded-full text-xl">
              {friends ? '👑' : '🎲'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display font-semibold">
                {friends ? 'ملك القعدة' : 'ثنية العرس'}
              </div>
              <div className="text-xs text-muted-foreground">
                {b
                  ? `الدورة ${Math.min(b.turns + (b.step === 'done' ? 0 : 1), state.maxTurns)} من ${state.maxTurns}`
                  : `الكود ${state.code}`}
              </div>
            </div>
            {friends ? (
              <SfxButton />
            ) : (
              <RoomMusic ducked={voice.talking.length > 0} />
            )}
            {b && b.step !== 'done' && (
              <span
                className={cn(
                  'grid min-w-11 place-items-center rounded-full px-2 py-1 text-sm font-bold tabular-nums',
                  left <= 5
                    ? 'animate-pulse bg-destructive/15 text-destructive'
                    : 'bg-muted',
                )}
                aria-label={`${left} ثانية`}
              >
                {left}
              </span>
            )}
          </div>
          {/* Who plays, in turn order */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {order.map((id) => {
              const p = byId.get(id)
              if (!p) return null
              const turn = b?.turnOf === id
              return (
                <span
                  key={id}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs',
                    turn
                      ? 'border-gold bg-gold/15 font-semibold'
                      : 'border-border',
                    !p.online && 'opacity-60',
                  )}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: colorOf(id) }}
                  />
                  {id === state.me.id ? 'إنتي' : p.name}
                  {!b?.team && b && !b.finished.includes(id) && (
                    <span className="tabular-nums text-muted-foreground">
                      · {b.pos[String(id)] ?? 0}
                    </span>
                  )}
                  {b && b.finished.includes(id) && (
                    <span>{MEDALS[b.finished.indexOf(id)] ?? '🏅'}</span>
                  )}
                  {turn && ' 🎲'}
                </span>
              )
            })}
          </div>
          <VoiceBar voice={voice} me={state.me} others={state.others} />
        </header>

        <main className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {state.phase === 'waiting' || !b ? (
            <Lobby
              state={state}
              code={code}
              token={token}
              onStarted={refresh}
              colorOf={colorOf}
            />
          ) : (
            <>
              <BoardView
                b={b}
                colorOf={colorOf}
                targetFor={targetFor}
                byId={byId}
                played={history}
                onPick={setOpenSquare}
              />
              <Legend team={b.team} />
              {b.step !== 'done' && (
                <div className="surface flex items-center gap-4 rounded-3xl p-4">
                  <Dice
                    value={b.roll?.value ?? null}
                    seq={rolling ? rollAnim?.seq : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    {b.step === 'roll' ? (
                      myTurn ? (
                        <>
                          <p className="font-semibold">
                            {b.team
                              ? 'دورك ترمي الزهر للزوز 🎲'
                              : 'دورك! ارمي الزهر 🎲'}
                          </p>
                          <Button
                            onClick={roll}
                            disabled={busy || !settled || holdLeft > 0}
                            className="btn-love mt-2 h-12 w-full rounded-xl text-base font-semibold"
                          >
                            {busy
                              ? 'لحظة…'
                              : holdLeft > 0
                                ? `👀 شوفو الأجوبة… (${holdLeft})`
                                : 'ارمي الزهر'}
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {b.finished.includes(state.me.id) && (
                            <span className="mb-1 block font-semibold text-gold">
                              {MEDALS[b.finished.indexOf(state.me.id)] ?? '🏅'}{' '}
                              وصلت للكرسي! تنجم تحكم على صحابك حتى يوصلو الكل
                            </span>
                          )}
                          نستنّاو {turnPlayer?.name ?? '…'}{' '}
                          {g(turnPlayer?.gender, 'يرمي', 'ترمي')} الزهر… ⏳
                        </p>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {b.question?.kind === 'dare'
                          ? '🎤 تحدّي على الكال…'
                          : b.team
                            ? '💬 سؤال! جاوبو الزوز…'
                            : '🗳️ الصحاب يحكمو…'}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <EventLog log={b.log} team={b.team} />
            </>
          )}
        </main>

        {b && questionVisible && b.question && (
          <QuestionSheet
            b={b}
            q={b.question}
            me={state.me.id}
            byId={byId}
            left={left}
            busy={busy}
            onAnswer={answer}
            voice={voice}
          />
        )}
        {b && obstacleVisible && b.obstacle && (
          <div className="pointer-events-none absolute inset-x-3 top-28 z-30 flex justify-center">
            <div className="pop-in w-full max-w-md rounded-3xl border border-destructive/50 bg-card p-5 text-center shadow-2xl">
              <p className="text-xs font-semibold text-destructive">🚧 عقبة!</p>
              <p className="mt-1 font-display text-xl font-bold">
                {b.obstacle.text}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                ارجعو {stepsWord(-b.obstacle.move)} 😅
              </p>
            </div>
          </div>
        )}
        {b && revealVisible && b.reveal && (
          <RevealToast b={b} r={b.reveal} me={state.me.id} byId={byId} />
        )}
        {b && b.step === 'done' && settled && !revealVisible && b.result && (
          <DoneCard b={b} result={b.result} me={state.me.id} byId={byId} />
        )}
        {b && openSquare != null && (
          <SquareHistory
            b={b}
            square={openSquare}
            entries={history.filter((e) => e.square === openSquare)}
            me={state.me.id}
            byId={byId}
            onClose={() => setOpenSquare(null)}
          />
        )}
        {confetti > 0 && <Confetti key={confetti} burst={confetti} />}
      </div>
    </div>
  )
}

/* --------------------------------- Pieces --------------------------------- */

function tileFill(kind: string) {
  switch (kind) {
    case 'question':
      return 'color-mix(in oklab, var(--sidi-blue) 26%, var(--card))'
    case 'fight':
      return 'color-mix(in oklab, var(--primary) 30%, var(--card))'
    case 'aunt':
      return 'color-mix(in oklab, var(--muted-foreground) 22%, var(--card))'
    case 'milestone':
    case 'start':
    case 'end':
      return 'color-mix(in oklab, var(--gold) 38%, var(--card))'
    default:
      return 'color-mix(in oklab, var(--foreground) 6%, var(--card))'
  }
}

function BoardView({
  b,
  colorOf,
  targetFor,
  byId,
  played,
  onPick,
}: {
  b: Board
  colorOf: (id: number) => string
  targetFor: (key: string) => number
  byId: Map<number, { name: string }>
  played: HistoryEntry[]
  onPick: (square: number) => void
}) {
  // How many questions were played on each square (from this browser's history)
  const counts = new Map<number, number>()
  for (const e of played) counts.set(e.square, (counts.get(e.square) ?? 0) + 1)
  const squares = boardSquares(b.team)
  // The road can be taller than friends' (the couple's is longer): fit the viewBox to its rows
  const rows = Math.ceil(squares.length / 8)
  const topY = 550 - (rows - 1) * 100
  const viewBox = `0 ${topY - 60} 800 ${660 - topY}`
  const road = squares
    .map((_, i) => cell(i))
    .map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`)
    .join(' ')
  const offsets = [
    [-16, -8],
    [16, -8],
    [-16, 16],
    [16, 16],
  ]
  return (
    <div className="surface overflow-hidden rounded-3xl p-2">
      <svg
        viewBox={viewBox}
        className="block h-auto w-full"
        role="img"
        aria-label="اللوحة"
      >
        <path
          d={road}
          fill="none"
          stroke="var(--gold)"
          strokeOpacity="0.25"
          strokeWidth="30"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {squares.map((_, i) => {
          const sq = squareFor(i, b.team)
          const p = cell(i)
          return (
            <g key={i}>
              <rect
                x={p.x - 43}
                y={p.y - 43}
                width="86"
                height="86"
                rx="16"
                fill={tileFill(sq.kind)}
                stroke="var(--border)"
                strokeWidth="2"
              >
                {sq.name && <title>{sq.name}</title>}
              </rect>
              <text
                x={p.x - 34}
                y={p.y - 26}
                fontSize="13"
                fill="var(--muted-foreground)"
                fontWeight="600"
              >
                {i}
              </text>
              {sq.icon && (
                <text
                  x={p.x}
                  y={p.y + 13}
                  fontSize={sq.kind === 'end' || sq.kind === 'start' ? 38 : 32}
                  textAnchor="middle"
                >
                  {sq.icon}
                </text>
              )}
            </g>
          )
        })}
        {b.team ? (
          <>
            <Pawn
              at={targetFor('team')}
              color={colorOf(b.order[0])}
              dx={-15}
              dy={0}
              name={byId.get(b.order[0])?.name}
              stack={0}
            />
            <Pawn
              at={targetFor('team')}
              color={colorOf(b.order[1])}
              dx={15}
              dy={4}
              name={byId.get(b.order[1])?.name}
              stack={1}
            />
          </>
        ) : (
          b.order.map((id, k) => {
            // Friends on the same square stack their name tags so none hides another
            const at = targetFor(String(id))
            const stack = b.order
              .slice(0, k)
              .filter((o) => targetFor(String(o)) === at).length
            return (
              <Pawn
                key={id}
                at={at}
                color={colorOf(id)}
                dx={offsets[k % 4][0]}
                dy={offsets[k % 4][1]}
                name={byId.get(id)?.name}
                stack={stack}
              />
            )
          })
        )}
        {/* Played squares: a gold counter, and a tap opens what happened there (above the pawns) */}
        {[...counts].map(([i, n]) => {
          const p = cell(i)
          return (
            <g
              key={`played-${i}`}
              role="button"
              tabIndex={0}
              aria-label={`المربّع ${i}: شوف شنوّة صار`}
              className="cursor-pointer outline-none"
              onClick={() => onPick(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onPick(i)
              }}
            >
              <rect
                x={p.x - 43}
                y={p.y - 43}
                width="86"
                height="86"
                rx="16"
                fill="transparent"
                stroke="var(--gold)"
                strokeOpacity="0.6"
                strokeWidth="2"
                strokeDasharray="6 5"
              />
              <circle cx={p.x + 32} cy={p.y - 32} r="12" fill="var(--gold)" />
              <text
                x={p.x + 32}
                y={p.y - 27}
                fontSize="14"
                fontWeight="700"
                textAnchor="middle"
                fill="oklch(0.2 0.03 260)"
              >
                {n}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** One question as this player saw it once it closed, kept for the board's history. */
type HistoryEntry = {
  seq: number
  square: number
  by: number
  kind: string
  text: string
  options: string[]
  /** Each option's points: only on questions about me (that's all the server ever sent) */
  moves: number[] | null
  answers: Record<string, number>
  delta: number
}

const historyKey = (code: string) => `firstdate:board-history:${code}`

function readHistory(code: string): HistoryEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(historyKey(code)) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

// The questions already played, kept in this browser only (localStorage), never in the
// database: each one is recorded as it closes, from what this player was shown. A tiny store,
// so every part of the page reads the same list.
const historyListeners = new Set<() => void>()
const historyCache = new Map<string, HistoryEntry[]>()
const NO_HISTORY: HistoryEntry[] = []

function historyOf(code: string) {
  let list = historyCache.get(code)
  if (!list) {
    list = readHistory(code)
    historyCache.set(code, list)
  }
  return list
}

function recordHistory(code: string, entry: HistoryEntry) {
  const list = historyOf(code)
  if (list.some((e) => e.seq === entry.seq)) return
  const next = [...list, entry]
  historyCache.set(code, next)
  try {
    localStorage.setItem(historyKey(code), JSON.stringify(next))
  } catch {
    // Private mode or full storage: the history still works until the page closes
  }
  historyListeners.forEach((l) => l())
}

function useBoardHistory(code: string, state: State | null) {
  const entries = useSyncExternalStore(
    (l) => {
      historyListeners.add(l)
      return () => historyListeners.delete(l)
    },
    () => historyOf(code),
    () => NO_HISTORY,
  )
  const r = state?.board?.reveal
  useEffect(() => {
    if (!r) return
    recordHistory(code, {
      seq: r.seq,
      square: r.square,
      by: r.by,
      kind: r.kind,
      text: r.text,
      options: r.options,
      moves: r.moves,
      answers: r.answers,
      delta: r.delta,
    })
  }, [r, code])
  return entries
}

/** What happened on a square: each question played there, the answers, and how far it moved. */
function SquareHistory({
  b,
  square,
  entries,
  me,
  byId,
  onClose,
}: {
  b: Board
  square: number
  entries: HistoryEntry[]
  me: number
  byId: Map<number, { name: string; gender: string | null }>
  onClose: () => void
}) {
  const nameOf = (id: number) => (id === me ? 'إنتي' : byId.get(id)?.name)
  return (
    <div
      className="absolute inset-0 z-30 flex items-end bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="pop-in max-h-[80%] w-full space-y-3 overflow-y-auto rounded-t-[2rem] border-t border-gold/50 bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-semibold">
            المربّع {square} {squareFor(square, b.team).icon}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={onClose}
          >
            سكّر
          </Button>
        </div>
        {[...entries].reverse().map((e) => (
          <div key={e.seq} className="space-y-2 rounded-2xl bg-muted/60 p-3.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-gold/20 px-2.5 py-0.5 font-semibold text-gold">
                {kindLabel(b.team, e.kind)}
              </span>
              {!b.team && (
                <span className="text-muted-foreground">
                  على {nameOf(e.by)}
                </span>
              )}
              <span
                className={cn(
                  'ms-auto rounded-full px-2 py-0.5 font-bold tabular-nums',
                  e.delta > 0
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : e.delta < 0
                      ? 'bg-destructive/15 text-red-300'
                      : 'bg-muted',
                )}
                dir="ltr"
              >
                {e.delta > 0 ? `+${e.delta}` : e.delta}
              </span>
            </div>
            <p className="font-semibold leading-relaxed">{e.text}</p>
            {b.team ? (
              <ul className="space-y-1 text-sm">
                {b.order.map((id) => {
                  const a = e.answers[String(id)]
                  return (
                    <li key={id} className="flex gap-2">
                      <span className="shrink-0 font-semibold">
                        {nameOf(id)}:
                      </span>
                      <span className="text-muted-foreground">
                        {a != null ? e.options[a] : '⏱ ما لحقش'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {e.options.map((o, i) => {
                  const voters = Object.entries(e.answers)
                    .filter(([, v]) => v === i)
                    .map(([id]) => nameOf(Number(id)))
                  return (
                    <li
                      key={i}
                      className={cn(
                        'flex items-center gap-2 rounded-xl px-2.5 py-1.5',
                        voters.length ? 'bg-background/60' : 'opacity-50',
                      )}
                    >
                      <span className="min-w-0">
                        {o}
                        {voters.length > 0 && (
                          <span className="text-xs text-sidi-blue">
                            {' '}
                            · {voters.join('، ')}
                          </span>
                        )}
                      </span>
                      {e.moves && <MoveBadge move={e.moves[i]} />}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A player's name on their pawn: up to 8 letters, longer names end with … */
const pawnName = (name: string) =>
  [...name].length > 8 ? `${[...name].slice(0, 8).join('')}…` : name

function Pawn({
  at,
  color,
  dx,
  dy,
  name,
  stack,
}: {
  at: number
  color: string
  dx: number
  dy: number
  name?: string
  /** How many name tags sit below this one on the same square */
  stack: number
}) {
  const shown = useStepper(at)
  const p = cell(shown)
  const tag = name ? pawnName(name) : ''
  const tagW = [...tag].length * 8 + 18
  return (
    <g
      style={{
        transform: `translate(${p.x + dx}px, ${p.y + dy}px)`,
        transition: `transform ${HOP_MS - 20}ms ease-out`,
      }}
    >
      <g
        key={shown}
        className="pawn-hop"
        style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
      >
        <ellipse cx="2" cy="18" rx="15" ry="5" fill="rgba(0,0,0,.35)" />
        <path
          d="M-13 16 Q-13 6 -6 3 L-4 -6 Q-11 -11 -10 -20 A11 11 0 1 1 10 -20 Q11 -11 4 -6 L6 3 Q13 6 13 16 Z"
          fill={color}
          stroke="rgba(0,0,0,.4)"
          strokeWidth="1.5"
        />
        {tag && (
          <g transform={`translate(0 ${-46 - stack * 22})`}>
            <rect
              x={-tagW / 2}
              y="-11"
              width={tagW}
              height="21"
              rx="10.5"
              fill={color}
              stroke="rgba(0,0,0,.35)"
              strokeWidth="1"
            />
            <text
              y="4.5"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="oklch(0.2 0.03 260)"
            >
              {tag}
            </text>
          </g>
        )}
      </g>
    </g>
  )
}

function Legend({ team }: { team: boolean }) {
  const items = team
    ? [
        [
          '💬',
          `سؤال: نفس الجواب +${EFFECT.questionSame}، مختلف ${EFFECT.questionDiff}`,
        ],
        [
          '⚡',
          `عراك: نفس الجواب +${EFFECT.fightSame}، مختلف ${EFFECT.fightDiff}`,
        ],
        ['🚧', 'عقبة: من −2 لـ −4'],
        ['🎉', 'العرس: الآخر'],
      ]
    : [
        ['💬', 'صحابك يحكمو عليك… والنتيجة مفاجأة 😏'],
        ['🎤', 'تحدّي على الكال، وصحابك يقيّمو'],
        ['👑', 'الكرسي: اللي يوصل الأوّل هو ملك القعدة'],
      ]
  return (
    <div className="flex flex-wrap justify-center gap-1.5 text-xs text-muted-foreground">
      {items.map(([icon, text]) => (
        <span key={icon} className="rounded-full bg-muted px-2.5 py-1">
          {icon} {text}
        </span>
      ))}
    </div>
  )
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function Dice({ value, seq }: { value: number | null; seq?: number }) {
  return (
    <div
      key={seq ?? 'still'}
      className={cn(
        'grid size-16 shrink-0 grid-cols-3 grid-rows-3 gap-0.5 rounded-2xl bg-[oklch(0.95_0.02_85)] p-2 shadow-lg shadow-black/30',
        seq != null && 'dice-tumble',
      )}
      aria-label={value ? `الزهر: ${value}` : 'الزهر'}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'm-auto size-2.5 rounded-full',
            value && PIPS[value].includes(i)
              ? 'bg-[oklch(0.2_0.03_260)]'
              : 'bg-transparent',
          )}
        />
      ))}
    </div>
  )
}

function EventLog({ log, team }: { log: Board['log']; team: boolean }) {
  if (!log.length) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        {team
          ? '👋 من التعارف حتّى العرس: 47 مربّع. بالتوفيق!'
          : '👑 47 مربّع حتّى الكرسي. شكون يكون ملك القعدة؟'}
      </p>
    )
  }
  return (
    <ul className="space-y-1.5">
      {log.slice(0, 6).map((e) => (
        <li
          key={`${e.seq}-${e.text}`}
          className={cn(
            'pop-in rounded-2xl px-3.5 py-2 text-sm',
            e.tone === 'good'
              ? 'bg-emerald-500/10 text-emerald-200'
              : e.tone === 'bad'
                ? 'bg-destructive/10 text-red-200'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {e.text}
        </li>
      ))}
    </ul>
  )
}

/** +2 / −1 badge for an option's points; only the player who rolled ever sees it. */
function MoveBadge({ move }: { move: number }) {
  return (
    <span
      className={cn(
        'ms-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
        move > 0
          ? 'bg-emerald-500/15 text-emerald-300'
          : move < 0
            ? 'bg-destructive/15 text-red-300'
            : 'bg-muted',
      )}
      dir="ltr"
    >
      {move > 0 ? `+${move}` : move}
    </span>
  )
}

const kindLabel = (team: boolean, kind: string) =>
  kind === 'dare'
    ? '🎤 تحدّي'
    : kind === 'fight'
      ? '⚡ عراك'
      : team
        ? '💬 سؤال'
        : '🗳️ صحابك يحكمو'

/**
 * A dare's mic: how many seconds the player who rolled has had it on (counted by the server),
 * and for that player a big button to turn it on.
 */
function MicMeter({
  seconds,
  needed,
  isRoller,
  rollerName,
  voice,
}: {
  seconds: number
  needed: number
  isRoller: boolean
  rollerName: string
  voice: ReturnType<typeof useVoice>
}) {
  const ok = seconds >= needed
  const micLive = voice.inCall && !voice.muted
  return (
    <div
      className={cn(
        'space-y-2 rounded-2xl border p-3',
        ok
          ? 'border-emerald-400/40 bg-emerald-500/10'
          : 'border-primary/40 bg-primary/10',
      )}
    >
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          {ok
            ? '🎙️ المايك تحلّ، برافو!'
            : isRoller
              ? '🎙️ المايك متاعك'
              : `🎙️ المايك متاع ${rollerName}`}
        </span>
        <span className="tabular-nums" dir="ltr">
          {Math.min(seconds, needed)}/{needed}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            ok ? 'bg-emerald-400' : 'bg-primary',
          )}
          style={{ width: `${Math.min(100, (seconds / needed) * 100)}%` }}
        />
      </div>
      {isRoller && !micLive && voice.open && (
        <Button
          onClick={voice.toggleMute}
          disabled={voice.joining}
          className="btn-love h-11 w-full rounded-xl font-semibold"
        >
          {voice.joining ? 'لحظة…' : '🎙️ حلّ المايك'}
        </Button>
      )}
      {isRoller && micLive && !ok && (
        <p className="text-xs text-muted-foreground">
          ✅ المايك محلول، اعمل التحدّي!
        </p>
      )}
      {voice.error && isRoller && (
        <p className="text-xs text-destructive">{voice.error}</p>
      )}
    </div>
  )
}

function QuestionSheet({
  b,
  q,
  me,
  byId,
  left,
  busy,
  onAnswer,
  voice,
}: {
  b: Board
  q: NonNullable<Board['question']>
  me: number
  byId: Map<number, { name: string; gender: string | null }>
  left: number
  busy: boolean
  onAnswer: (option: number) => void
  voice: ReturnType<typeof useVoice>
}) {
  const hot = q.kind === 'fight' || q.kind === 'dare'
  const rollerName = byId.get(q.by)?.name ?? ''
  const isRoller = !b.team && q.by === me
  const canAnswer = q.answerers.includes(me)
  const hint = b.team
    ? q.kind === 'fight'
      ? `⚡ نفس الجواب: +${EFFECT.fightSame} · مختلف: ${EFFECT.fightDiff}`
      : `🎯 جاوبو بصراحة: نفس الجواب +${EFFECT.questionSame} · مختلف ${EFFECT.questionDiff}`
    : q.kind === 'dare'
      ? isRoller
        ? `🎤 حلّ المايك واعمل التحدّي توّا! لازم المايك يقعد محلول ${q.micNeeded} ثواني على الأقل، وإلا ترجع زوز خطوات`
        : `🎧 اسمعو ${rollerName} على الكال، ومن بعد قيّمو`
      : isRoller
        ? '😅 صحابك يقرّرو شنوّة تعمل! إنت برك تشوف قدّاش يسوى كل جواب، هوما ما يعرفوش'
        : `🗳️ إنتوما تقرّرو! اختارو بصراحة، وقدّاش يتحرّك ${rollerName} يبان من بعد 😏`
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-background/60 backdrop-blur-sm">
      <div
        className={cn(
          'pop-in w-full space-y-3 rounded-t-[2rem] border-t bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl',
          hot ? 'border-primary/60' : 'border-gold/50',
        )}
      >
        <div className="flex items-center justify-between text-xs">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 font-semibold',
              hot ? 'bg-primary/20 text-primary' : 'bg-gold/20 text-gold',
            )}
          >
            {kindLabel(b.team, q.kind)}
          </span>
          <span
            className={cn('tabular-nums', left <= 10 && 'text-destructive')}
          >
            ⏱ {left}
          </span>
        </div>
        <p className="font-display text-xl font-semibold leading-relaxed">
          {q.text}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {q.kind === 'dare' && !b.team && (
          <MicMeter
            seconds={q.micSeconds}
            needed={q.micNeeded}
            isRoller={isRoller}
            rollerName={rollerName}
            voice={voice}
          />
        )}
        <div className="grid gap-2">
          {q.options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={busy || !canAnswer || q.mine != null}
              onClick={() => onAnswer(i)}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2.5 text-start text-[15px] font-medium transition active:scale-[0.98]',
                q.mine === i
                  ? 'border-gold bg-gold/15'
                  : 'border-border bg-background/60',
                canAnswer && q.mine == null && 'hover:border-gold',
                ((q.mine != null && q.mine !== i) || !canAnswer) &&
                  'opacity-60',
              )}
            >
              <span className="bubble-gold grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold">
                {['أ', 'ب', 'ج'][i]}
              </span>
              <span className="min-w-0">{o}</span>
              {q.mine === i && <Check className="size-4 shrink-0 text-gold" />}
              {q.moves && <MoveBadge move={q.moves[i]} />}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {q.answerers.map((id) => (
            <span
              key={id}
              className={cn(
                'rounded-full px-2 py-0.5',
                q.answered.includes(id)
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-muted',
              )}
            >
              {q.answered.includes(id) ? '✓' : '…'}{' '}
              {id === me ? 'إنتي' : byId.get(id)?.name}
            </span>
          ))}
          {isRoller && <span className="ms-auto">🤞 نستنّاو الحكم…</span>}
        </div>
      </div>
    </div>
  )
}

function RevealToast({
  b,
  r,
  me,
  byId,
}: {
  b: Board
  r: NonNullable<Board['reveal']>
  me: number
  byId: Map<number, { name: string; gender: string | null }>
}) {
  const up = r.delta > 0
  const down = r.delta < 0
  const nameOf = (id: number) => (id === me ? 'إنتي' : byId.get(id)?.name)
  const who = nameOf(r.by) ?? ''
  const title = b.team
    ? r.matched
      ? 'نفس الجواب!'
      : 'ما تفاهمتوش!'
    : r.noMic
      ? `🔇 ${who} ما ${r.by === me ? 'حلّيتش' : g(byId.get(r.by)?.gender, 'حلّش', 'حلّتش')} المايك!`
      : up
        ? `صحابك حكمو لصالح ${who} 🎉`
        : down
          ? `صحابك حكمو على ${who} 😅`
          : 'ما فمّاش حكم'
  return (
    <div className="pointer-events-none absolute inset-x-3 top-28 z-30 flex justify-center">
      <div
        className={cn(
          'pop-in w-full max-w-md rounded-3xl border bg-card p-4 shadow-2xl',
          up
            ? 'border-emerald-400/50'
            : down
              ? 'border-destructive/50'
              : 'border-border',
        )}
      >
        <p className="text-center font-display text-lg font-bold">
          {up ? '✅ ' : down ? '❌ ' : ''}
          {title}{' '}
          <span
            className={cn(
              'tabular-nums',
              up
                ? 'text-emerald-300'
                : down
                  ? 'text-destructive'
                  : 'text-muted-foreground',
            )}
            dir="ltr"
          >
            {up ? `+${r.delta}` : r.delta}
          </span>
        </p>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {r.text}
        </p>
        {b.team ? (
          <ul className="mt-2 space-y-1 text-sm">
            {b.order.map((id) => {
              const a = r.answers[String(id)]
              return (
                <li key={id} className="flex gap-2">
                  <span className="shrink-0 font-semibold">{nameOf(id)}:</span>
                  <span className="text-muted-foreground">
                    {a != null ? r.options[a] : '⏱ ما لحقش'}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          // Friends: every option with who voted for it
          <ul className="mt-2 space-y-1.5 text-sm">
            {r.options.map((o, i) => {
              const voters = Object.entries(r.answers)
                .filter(([, v]) => v === i)
                .map(([id]) => nameOf(Number(id)))
              return (
                <li
                  key={i}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-2.5 py-1.5',
                    voters.length ? 'bg-muted' : 'opacity-50',
                  )}
                >
                  <span className="min-w-0">
                    {o}
                    {voters.length > 0 && (
                      <span className="text-xs text-sidi-blue">
                        {' '}
                        · {voters.join('، ')}
                      </span>
                    )}
                  </span>
                  {r.moves && <MoveBadge move={r.moves[i]} />}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

const PLACE_WORDS: [string, string][] = [
  ['الأوّل', 'الأولى'],
  ['الثاني', 'الثانية'],
  ['الثالث', 'الثالثة'],
  ['الرابع', 'الرابعة'],
]

/** The story picture of a finished board game, for Instagram and the like. */
function shareInput(
  b: Board,
  result: NonNullable<Board['result']>,
  me: number,
  byId: Map<number, { name: string; gender: string | null }>,
): ShareCardInput {
  const nameOf = (id: number) => byId.get(id)?.name ?? ''
  if (b.team) {
    const names = b.order.map(nameOf).join(' 💍 ')
    const pos = b.pos.team ?? 0
    return result.won
      ? {
          mode: 'date',
          label: '🎲 ثنية العرس',
          names,
          score: 100,
          progress: 1,
          big: '💍',
          line: `وصلنا للعرس في ${result.turns} دورة!`,
          cta: 'وإنتوما، في قدّاش من دورة توصلو؟ 🎲',
        }
      : {
          mode: 'date',
          label: '🎲 ثنية العرس',
          names,
          score: 0,
          progress: pos / 47,
          big: String(pos),
          line: `وقفنا في المربّع ${pos} من 47… المرّة الجاية العرس 😅`,
          cta: 'وإنتوما، توصلو للعرس؟ 🎲',
        }
  }
  const ranking = result.ranking ?? []
  const place = Math.max(0, ranking.indexOf(me))
  const mine = byId.get(me)
  const [m, f] = PLACE_WORDS[place] ?? PLACE_WORDS[3]
  return {
    mode: 'friends',
    label: '👑 ملك القعدة',
    names: nameOf(me),
    score: 0,
    progress: ranking.length ? (ranking.length - place) / ranking.length : 1,
    big: MEDALS[place] ?? `${place + 1}`,
    line:
      place === 0
        ? `أنا ${g(mine?.gender, 'ملك', 'ملكة')} القعدة!`
        : `جيت ${g(mine?.gender, m, f)} في ملك القعدة`,
    extra: ranking
      .slice(0, 4)
      .map((id, i) => `${MEDALS[i] ?? ''} ${nameOf(id)}`)
      .join(' · '),
    cta: 'شكون فيكم ملك القعدة؟ 👀',
  }
}

function DoneCard({
  b,
  result,
  me,
  byId,
}: {
  b: Board
  result: NonNullable<Board['result']>
  me: number
  byId: Map<number, { name: string; gender: string | null }>
}) {
  const winner = result.winner != null ? byId.get(result.winner) : undefined
  const title = b.team
    ? result.won
      ? `🎉 وصلتو للعرس في ${result.turns} دورة!`
      : `😅 كملو الدورات وما وصلتوش`
    : result.winner === me
      ? '👑 إنتي ملك القعدة!'
      : `👑 ${winner?.name ?? ''} ${g(winner?.gender, 'ملك', 'ملكة')} القعدة!`
  const sub = b.team
    ? result.won
      ? 'كل ما تتفقو أكثر، توصلو أسرع. تنجمو تعاودو وتكسرو الرقم 💍'
      : `وقفتو في المربّع ${b.pos.team ?? 0} من 47. عاودو، المرّة الجاية توصلو 💪`
    : 'عاودو لعبة أخرى وشوفو شكون ياخذ الكرسي المرّة الجاية 🎲'
  const ranking = result.ranking ?? []
  const share = shareInput(b, result, me, byId)
  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-background/70 px-5 py-6 backdrop-blur-sm">
      <div className="surface pop-in w-full max-w-sm rounded-3xl p-6 text-center">
        <p className="font-display text-2xl font-bold leading-snug">{title}</p>
        {!b.team && ranking.length > 0 && (
          // Everyone, first to last: those who reached the throne in order, then the rest by position
          <ol className="mt-4 space-y-1.5 text-start">
            {ranking.map((id, i) => {
              const arrived = b.finished.includes(id)
              return (
                <li
                  key={id}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
                    i === 0 ? 'bg-gold/15 font-semibold' : 'bg-muted',
                  )}
                >
                  <span className="w-6 text-center">
                    {arrived ? (MEDALS[i] ?? '🏅') : `${i + 1}.`}
                  </span>
                  <span className="flex-1">
                    {id === me ? 'إنتي' : byId.get(id)?.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {arrived
                      ? `${g(byId.get(id)?.gender, 'وصل', 'وصلت')} للكرسي`
                      : `المربّع ${b.pos[String(id)] ?? 0}`}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
        <p className="mt-3 text-sm text-muted-foreground">{sub}</p>
        <div className="mt-5">
          <ShareResultButton
            input={share}
            friends={!b.team}
            note="الصورة فيها النتيجة برك 📸"
          />
        </div>
        <Button
          asChild
          variant="outline"
          className="mt-3 h-12 w-full rounded-xl text-base font-semibold"
        >
          <Link to="/">لعبة جديدة 🎲</Link>
        </Button>
      </div>
    </div>
  )
}

function Lobby({
  state,
  code,
  token,
  onStarted,
  colorOf,
}: {
  state: State
  code: string
  token: string
  onStarted: () => void
  colorOf: (id: number) => string
}) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const friends = state.mode === 'board_friends'
  const link =
    typeof window !== 'undefined'
      ? `${window.location.origin}/room/${code}`
      : ''
  const message = friends
    ? `تعال نلعبو ملك القعدة 👑 شكون يوصل للكرسي الأوّل؟\nالكود: ${code}\n${link}`
    : `تعال نلعبو ثنية العرس 🎲💍 من التعارف حتّى العرس!\nالكود: ${code}\n${link}`

  function copy() {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true)
        toast.success('تنسخ الرابط، ابعثو')
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('ما نجّمناش ننسخو، انسخ الكود بيدك'))
  }

  async function start() {
    setBusy(true)
    try {
      await startRoom({ data: { code, token, seen: [] } })
      onStarted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'صار مشكل، عاود جرّب')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="surface rounded-3xl p-5 text-center">
        <p className="eyebrow">{friends ? '👑 ملك القعدة' : '🎲 ثنية العرس'}</p>
        <p className="mt-2 font-display text-xl font-bold">
          {friends ? 'استدعي صحابك (من 2 لـ 4)' : 'ابعث الرابط للشخص الآخر'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {friends
            ? 'كل واحد عندو بيدق، صحابك يحكمو عليك، واللي يوصل للكرسي الأوّل هو ملك القعدة 👑'
            : 'تلعبو مع بعضكم بزوز بيادق: عندكم 20 دورة باش توصلو للعرس.'}
        </p>
        <p
          className="mt-3 font-mono text-2xl font-bold tracking-[0.3em]"
          dir="ltr"
        >
          {code}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={copy} className="rounded-xl">
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}{' '}
            انسخ الرابط
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() =>
              navigator.share?.({ text: message }).catch(() => {}) ?? copy()
            }
          >
            <Share2 className="size-4" /> ابعث
          </Button>
        </div>
      </div>
      <ul className="surface space-y-2 rounded-3xl p-4">
        {state.players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <span
              className="size-3 rounded-full"
              style={{ background: colorOf(p.id) }}
            />
            <span className="font-semibold">
              {p.id === state.me.id ? 'إنتي' : p.name}
            </span>
            {p.host && (
              <span className="text-xs text-muted-foreground">
                (اللي حلّ اللعبة)
              </span>
            )}
          </li>
        ))}
        {state.players.length < state.maxPlayers && (
          <li className="text-sm text-muted-foreground">⏳ نستنّاو…</li>
        )}
      </ul>
      {friends && state.me.host && (
        <Button
          onClick={start}
          disabled={busy || state.players.length < 2}
          className="btn-love h-12 w-full rounded-xl text-base font-semibold"
        >
          {state.players.length < 2
            ? 'استنّى صاحب واحد على الأقل'
            : busy
              ? 'لحظة…'
              : `ابداو (${state.players.length} لاعبين) 🎲`}
        </Button>
      )}
      {friends && !state.me.host && (
        <p className="text-center text-sm text-muted-foreground">
          نستنّاو اللي حلّ اللعبة يبداها…
        </p>
      )}
    </div>
  )
}
