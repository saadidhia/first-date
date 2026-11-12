// ثنية العرس: the board game. A road of 48 squares from التعارف to العرس.
// A couple (mode 'board') shares one pair of pawns and takes turns rolling; they have 20 rolls
// to reach the wedding. Friends (mode 'board_friends', 2 to 4) race, one pawn each, and play on
// until they all reach the throne: the first is ملك القعدة, the others take their places. Each
// friend has 20 rolls; whoever is still on the road after that is ranked by how far they got.
//
// Squares: 💬 a question, ⚡ عراك (a hard question with bigger stakes), 👵 عمّتو (back 2), and
// milestones along the way. A couple both answer and move on when they agree. With friends the
// player who rolled never answers: on 💬 "صحابك يحكمو" the others pick what that player would do
// (each answer carries its own move), and ⚡ becomes 🎤 تحدّي, a dare done on the voice call
// that the others rate. Pure functions only: the server keeps the state in `rooms.board` and
// calls these with the dice value and a random source.

import {
  BOARD_EASY,
  BOARD_HARD,
  BOARD_MEDIUM,
  type BoardRawQuestion,
} from './bank/board'
import {
  DARE_VOTES,
  FRIENDS_DARES,
  FRIENDS_EASY,
  FRIENDS_HARD,
  FRIENDS_MEDIUM,
  type FriendsRawQuestion,
} from './bank/board-friends'
import { personalize } from './questions'

export const BOARD_SIZE = 48
export const LAST = BOARD_SIZE - 1
export const MAX_TURNS = 20
export const ROLL_SECONDS = 25
export const ANSWER_SECONDS = 40
/** After a question closes, everyone gets this long to read the answers before the next roll */
export const REVEAL_SECONDS = 8
/** A dare is done out loud: the player who rolled must keep the mic on at least this long… */
export const MIC_SECONDS = 5
/** …or they go back this far, whatever the friends voted */
export const MIC_PENALTY = -2

/** How far a square's outcome moves the pawn. */
export const EFFECT = {
  questionSame: 2,
  questionDiff: -1,
  fightSame: 1,
  fightDiff: -2,
  aunt: -2,
} as const

export type SquareKind =
  'start' | 'end' | 'milestone' | 'question' | 'fight' | 'aunt' | 'plain'
export type Square = { kind: SquareKind; icon: string; name: string }

const MILESTONES: Record<number, [string, string]> = {
  8: ['☕', 'أوّل قهوة'],
  16: ['👨‍👩‍👧', 'العايلة'],
  24: ['💍', 'الخطوبة'],
  32: ['📜', 'الملاك'],
  40: ['🌿', 'الحنّة'],
}
const AUNT = new Set([13, 27, 37, 44])
const FIGHT = new Set([19, 30, 42])

export const SQUARES: Square[] = Array.from({ length: BOARD_SIZE }, (_, i) => {
  if (i === 0) return { kind: 'start', icon: '👋', name: 'التعارف' }
  if (i === LAST) return { kind: 'end', icon: '🎉', name: 'العرس' }
  const m = MILESTONES[i]
  if (m) return { kind: 'milestone', icon: m[0], name: m[1] }
  if (AUNT.has(i)) return { kind: 'aunt', icon: '👵', name: 'عمّتو' }
  if (FIGHT.has(i)) return { kind: 'fight', icon: '⚡', name: 'عراك' }
  if (i % 2 === 1) return { kind: 'question', icon: '💬', name: 'سؤال' }
  return { kind: 'plain', icon: '', name: '' }
})

/** A square as players see it: with friends, ⚡ عراك is a 🎤 dare instead. */
// ملك القعدة (friends) is a day out with the gang, not the road to a wedding: its own stops,
// the throne at the end, and no square that sends you back
const FRIENDS_STOPS: Record<number, [string, string]> = {
  0: ['👋', 'البداية'],
  8: ['☕', 'القهوة'],
  16: ['⚽', 'الماتش'],
  24: ['🏖️', 'البحر'],
  32: ['🍕', 'الماكلة'],
  40: ['🎶', 'السهرية'],
  [LAST]: ['👑', 'الكرسي'],
}

/** A square as players see it. With friends: ⚡ is a 🎤 dare, the stops are theirs, and there's no عمّتو. */
export function squareFor(i: number, team: boolean): Square {
  const sq = SQUARES[i]
  if (team)
    return sq.kind === 'aunt' ? { kind: 'aunt', icon: '🚧', name: 'عقبة' } : sq
  const stop = FRIENDS_STOPS[i]
  if (stop) return { ...sq, icon: stop[0], name: stop[1] }
  if (sq.kind === 'fight') return { kind: 'fight', icon: '🎤', name: 'تحدّي' }
  if (sq.kind === 'aunt')
    return i % 2 === 1
      ? { kind: 'question', icon: '💬', name: 'سؤال' }
      : { kind: 'plain', icon: '', name: '' }
  return sq
}

/* -------------------------------- Questions ------------------------------- */

export type Tier = 'e' | 'm' | 'h'
const BANKS: Record<Tier, BoardRawQuestion[]> = {
  e: BOARD_EASY,
  m: BOARD_MEDIUM,
  h: BOARD_HARD,
}

/** Easy at the start, harder towards the wedding; a fight is always hard. */
export function tierAt(pos: number, kind: 'question' | 'fight'): Tier {
  if (kind === 'fight' || pos >= 32) return 'h'
  return pos >= 16 ? 'm' : 'e'
}

const FRIENDS_BANKS: Record<Tier, FriendsRawQuestion[]> = {
  e: FRIENDS_EASY,
  m: FRIENDS_MEDIUM,
  h: FRIENDS_HARD,
}

export type BoardQuestion = {
  text: string
  options: string[]
  /** Friends questions and dares: how far each option moves the player who rolled */
  moves: number[] | null
}

/**
 * A board question as one player sees it, or null for an unknown id. `gender` is the player
 * reading it (couple questions); `about` is the player who rolled (friends questions and dares).
 */
export function boardQuestion(
  id: string,
  gender?: string | null,
  about?: { name: string; gender: string | null } | null,
): BoardQuestion | null {
  const couple = /^board_([emh])_(\d+)$/.exec(id)
  if (couple) {
    const raw = BANKS[couple[1] as Tier][Number(couple[2])]
    if (!raw) return null
    const [text, ...options] = raw
    return {
      text: personalize(text, gender, null),
      options: options.map((o) => personalize(o, gender, null)),
      moves: null,
    }
  }
  // Friends: worded for the player who rolled ({name}, and {m|f} for their gender)
  const word = (t: string) =>
    personalize(
      t.replaceAll('{name}', about?.name ?? '…'),
      gender,
      about?.gender === 'female' ? 'female' : 'male',
    )
  const friends = /^fq_([emh])_(\d+)$/.exec(id)
  if (friends) {
    const raw = FRIENDS_BANKS[friends[1] as Tier][Number(friends[2])]
    if (!raw) return null
    const [text, ...options] = raw
    return {
      text: word(text),
      options: options.map(([t]) => word(t)),
      moves: options.map(([, move]) => move),
    }
  }
  const dare = /^fd_(\d+)$/.exec(id)
  if (dare) {
    const raw = FRIENDS_DARES[Number(dare[1])]
    if (!raw) return null
    return {
      text: word(raw),
      options: DARE_VOTES.map(([t]) => t),
      moves: DARE_VOTES.map(([, move]) => move),
    }
  }
  return null
}

function pickFrom(ids: string[], asked: string[], rand: () => number) {
  const fresh = ids.filter((id) => !asked.includes(id))
  const pool = fresh.length ? fresh : ids
  return pool[Math.floor(rand() * pool.length)]
}

/** A couple question of that level the room hasn't had yet (any of them once all were asked). */
export function pickBoardQuestion(
  tier: Tier,
  asked: string[],
  rand: () => number,
) {
  return pickFrom(
    BANKS[tier].map((_, i) => `board_${tier}_${i}`),
    asked,
    rand,
  )
}

/** A friends question ('question') or a dare ('dare') the room hasn't had yet. */
export function pickFriendsQuestion(
  kind: 'question' | 'dare',
  tier: Tier,
  asked: string[],
  rand: () => number,
) {
  const ids =
    kind === 'dare'
      ? FRIENDS_DARES.map((_, i) => `fd_${i}`)
      : FRIENDS_BANKS[tier].map((_, i) => `fq_${tier}_${i}`)
  return pickFrom(ids, asked, rand)
}

/**
 * Where the friends' votes send the player who rolled: every vote counts, so the move is the
 * sum of the points of the options they picked (two friends on +2 and −1: +1). Nobody voted: no move.
 */
export function verdict(votes: number[], moves: number[]) {
  return votes.reduce((sum, v) => sum + (moves[v] ?? 0), 0)
}

/* ---------------------------------- State --------------------------------- */

export type Tone = 'good' | 'bad' | 'info'
/** question: 💬 · fight: ⚡ عراك (couples) · dare: 🎤 تحدّي (friends) */
export type QuestionKind = 'question' | 'fight' | 'dare'
export type BoardEvent = { seq: number; text: string; tone: Tone }

export type BoardState = {
  v: 1
  /** A couple sharing one pair of pawns (key 'team'), or friends racing (key = player id) */
  team: boolean
  /** Player ids in turn order */
  order: number[]
  /** Index in `order` of the player whose turn it is */
  turn: number
  /** Dice rolls made so far */
  rolls: number
  pos: Record<string, number>
  step: 'roll' | 'question' | 'done'
  /** When the current step times out (ms since epoch): the dice rolls itself, the question closes */
  endsAt: number
  /** Bumped on every change; the server only saves over the version it read */
  seq: number
  roll: {
    seq: number
    by: number
    value: number
    from: number
    to: number
  } | null
  question: {
    seq: number
    id: string
    kind: QuestionKind
    by: number
    answers: Record<string, number>
    /** Dares: how long the player who rolled had the mic on (ms), and when it was last seen on */
    micMs?: number
    micLast?: number
  } | null
  /** The last question once it closed: who picked what and where it sent the pawn */
  reveal: {
    seq: number
    id: string
    kind: QuestionKind
    by: number
    answers: Record<string, number>
    matched: boolean
    delta: number
    from: number
    to: number
    /** A dare done without the mic on long enough: MIC_PENALTY, whatever the votes */
    noMic?: boolean
  } | null
  log: BoardEvent[]
  asked: string[]
  /** The last 🚧 obstacle a couple hit (on the roll with this seq), shown as it happens */
  obstacle?: { seq: number; text: string } | null
  /** Nobody can roll before this (ms since epoch): time to read the answers of the last question */
  holdUntil?: number
  /** Friends: who reached 👑 الكرسي, in order of arrival (the game goes on until they all do) */
  finished?: number[]
  /** Friends: how many times each player rolled; each has MAX_TURNS rolls */
  rolled?: Record<string, number>
  result: {
    won: boolean
    winner: number | null
    turns: number
    /** Friends: everyone, first to last */
    ranking?: number[]
  } | null
}

export type BoardPerson = { id: number; name: string; gender: string | null }
type People = Map<number, BoardPerson>

export const keyOf = (s: BoardState, playerId: number) =>
  s.team ? 'team' : String(playerId)
export const rollerOf = (s: BoardState) => s.order[s.turn]
const rolledOf = (s: BoardState, id: number) => s.rolled?.[String(id)] ?? 0
export const arrivedAt = (s: BoardState, id: number) =>
  (s.finished ?? []).indexOf(id) + 1
/** A friend still on the road: not at the throne yet, and rolls left */
const stillPlaying = (s: BoardState, id: number) =>
  !arrivedAt(s, id) && rolledOf(s, id) < MAX_TURNS

/** Turns used: every roll for a couple; for friends, the most rolls anyone made. */
export const turnsUsed = (s: BoardState) =>
  s.team ? s.rolls : Math.max(0, ...s.order.map((id) => rolledOf(s, id)))

const g = (p: BoardPerson | undefined, m: string, f: string) =>
  p?.gender === 'female' ? f : m
const nameOf = (people: People, id: number) => people.get(id)?.name ?? '؟'

/** "to" a place: للقهوة, للخطوبة (ل + ال joins as لل) */
const to_ = (place: string) =>
  place.startsWith('ال') ? `لل${place.slice(2)}` : `لـ${place}`

/** Who answers the open question: both of a couple; with friends, everyone but the player who rolled. */
export const answerersOf = (s: BoardState, by: number) =>
  s.team ? s.order : s.order.filter((id) => id !== by)

export function initBoard(
  order: number[],
  team: boolean,
  now: number,
): BoardState {
  return {
    v: 1,
    team,
    order,
    turn: 0,
    rolls: 0,
    pos: team
      ? { team: 0 }
      : Object.fromEntries(order.map((id) => [String(id), 0])),
    step: 'roll',
    endsAt: now + ROLL_SECONDS * 1000,
    seq: 1,
    roll: null,
    question: null,
    reveal: null,
    log: [],
    asked: [],
    result: null,
  }
}

const clone = (s: BoardState): BoardState => structuredClone(s)

function log(s: BoardState, text: string, tone: Tone) {
  s.log = [{ seq: s.seq, text, tone }, ...s.log].slice(0, 12)
}

function finish(
  s: BoardState,
  reachedBy: number | null,
  people: People,
): BoardState {
  s.step = 'done'
  s.question = null
  if (s.team) {
    const won = reachedBy != null
    s.result = { won, winner: null, turns: turnsUsed(s) }
    log(
      s,
      won
        ? `🎉 وصلتو للعرس في ${s.rolls} دورة!`
        : `⏱ كملو الـ${MAX_TURNS} دورة وما وصلتوش للعرس 😅`,
      won ? 'good' : 'bad',
    )
    return s
  }
  // Friends: those who reached the throne in order of arrival, then the rest by how far they got
  // (the first in turn order on a tie)
  const finished = s.finished ?? []
  const rest = s.order
    .filter((id) => !finished.includes(id))
    .sort((a, b) => (s.pos[String(b)] ?? 0) - (s.pos[String(a)] ?? 0))
  const ranking = [...finished, ...rest]
  const winner = ranking[0]
  s.result = { won: true, winner, turns: turnsUsed(s), ranking }
  const w = people.get(winner)
  const crown = `${nameOf(people, winner)} ${g(w, 'ملك', 'ملكة')} القعدة 👑`
  log(
    s,
    rest.length ? `⏱ كملو الدورات! ${crown}` : `🏁 وصلو الكل للكرسي! ${crown}`,
    'good',
  )
  return s
}

const PLACES: [string, string][] = [
  ['الأوّل', 'الأولى'],
  ['الثاني', 'الثانية'],
  ['الثالث', 'الثالثة'],
  ['الرابع', 'الرابعة'],
]
const MEDALS = ['👑', '🥈', '🥉', '🏅']

/** A friend reached 👑 الكرسي: they take their place, and the game goes on for the others. */
function arrive(
  s: BoardState,
  id: number,
  now: number,
  people: People,
): BoardState {
  if (!arrivedAt(s, id)) s.finished = [...(s.finished ?? []), id]
  const place = arrivedAt(s, id)
  const p = people.get(id)
  const [m, f] = PLACES[place - 1] ?? PLACES[3]
  log(
    s,
    `${MEDALS[place - 1] ?? '🏅'} ${nameOf(people, id)} ${g(p, 'وصل', 'وصلت')} للكرسي ${g(p, m, f)}` +
      (place === 1 ? `: ${g(p, 'ملك', 'ملكة')} القعدة!` : ''),
    'good',
  )
  return nextTurn(s, now, people)
}

function nextTurn(s: BoardState, now: number, people: People): BoardState {
  const n = s.order.length
  if (s.team) {
    if (s.rolls >= MAX_TURNS) return finish(s, null, people)
    s.turn = (s.turn + 1) % n
  } else {
    // The next friend still on the road; once nobody is, the game is over
    let next = -1
    for (let k = 1; k <= n; k++) {
      const j = (s.turn + k) % n
      if (stillPlaying(s, s.order[j])) {
        next = j
        break
      }
    }
    if (next < 0) return finish(s, null, people)
    s.turn = next
  }
  s.step = 'roll'
  s.endsAt = now + ROLL_SECONDS * 1000
  return s
}

/**
 * The obstacles on a couple's 🚧 squares, one picked at random each time. `{x}` is the name of
 * one of the two, picked at random, so the families get involved (بو سارة موش موافق).
 */
export const OBSTACLES = [
  '👴 بو {x} موش موافق!',
  '🧱 بو {x} حطّ العصا في العجلة',
  '⚡ عركة كبيرة على حاجة تافهة',
  '💸 ما فمّاش فلوس للعرس',
  '👵 عمّتو جات',
  '👵 عمّتو تحب تاخذلو بنتها',
  '👵 خالتو تحب تاخذو لبنتها',
  '🏠 ما لقيتوش دار',
  '📱 غيرة على ميساج',
  '👵 أمّ {x} عندها شروط',
  '📅 تأجّل العرس، الصالة محجوزة',
]

export function obstacleText(i: number, names: string[], rand: () => number) {
  const name = names[Math.floor(rand() * names.length)] ?? ''
  return OBSTACLES[i % OBSTACLES.length].replaceAll('{x}', name)
}

/** The player whose turn it is rolled `value` (1-6). */
export function applyRoll(
  prev: BoardState,
  value: number,
  now: number,
  people: People,
  rand: () => number,
  auto = false,
): BoardState {
  if (prev.step !== 'roll') return prev
  // Still showing the last question's answers (a roll that timed out waits for it too)
  if (prev.holdUntil && now < prev.holdUntil) return prev
  const s = clone(prev)
  const by = rollerOf(s)
  const p = people.get(by)
  const k = keyOf(s, by)
  const from = s.pos[k] ?? 0
  const to = Math.min(LAST, from + value)
  s.seq++
  s.rolls++
  if (!s.team) s.rolled = { ...s.rolled, [String(by)]: rolledOf(s, by) + 1 }
  s.pos[k] = to
  s.roll = { seq: s.seq, by, value, from, to }
  s.reveal = null
  log(
    s,
    auto
      ? `⏱ ${nameOf(people, by)} ما ${g(p, 'رماش', 'رماتش')}، الزهر رمى وحدو ${value}`
      : `🎲 ${nameOf(people, by)} ${g(p, 'رمى', 'رمات')} ${value}`,
    'info',
  )
  if (to === LAST)
    return s.team ? finish(s, by, people) : arrive(s, by, now, people)

  const sq = squareFor(to, s.team)
  if (sq.kind === 'question' || sq.kind === 'fight') {
    const tier = tierAt(to, sq.kind)
    const kind: QuestionKind = !s.team && sq.kind === 'fight' ? 'dare' : sq.kind
    const id = s.team
      ? pickBoardQuestion(tier, s.asked, rand)
      : pickFriendsQuestion(
          kind === 'dare' ? 'dare' : 'question',
          tierAt(to, 'question'),
          s.asked,
          rand,
        )
    s.asked = [...s.asked, id]
    s.step = 'question'
    s.endsAt = now + ANSWER_SECONDS * 1000
    s.question = { seq: s.seq, id, kind, by, answers: {} }
    return s
  }
  if (sq.kind === 'aunt') {
    // A couple's 🚧: a different obstacle each time, about one of them (their names) or both
    s.pos[k] = Math.max(0, to + EFFECT.aunt)
    const text = obstacleText(
      Math.floor(rand() * OBSTACLES.length),
      s.order.map((id) => nameOf(people, id)),
      rand,
    )
    s.obstacle = { seq: s.seq, text }
    log(s, `${text}: ارجعو زوز خطوات 😅`, 'bad')
  } else if (sq.kind === 'milestone') {
    log(
      s,
      s.team
        ? `${sq.icon} وصلتو ${to_(sq.name)}!`
        : `${sq.icon} ${nameOf(people, by)} ${g(p, 'وصل', 'وصلت')} ${to_(sq.name)}`,
      'good',
    )
  }
  return nextTurn(s, now, people)
}

/** Closes the open question: who matched, and where that sends the pawn. */
function resolve(prev: BoardState, now: number, people: People): BoardState {
  const q = prev.question
  if (prev.step !== 'question' || !q) return prev
  const s = clone(prev)
  const k = keyOf(s, q.by)
  const at = (id: number) => q.answers[String(id)]
  const noMic =
    !s.team && q.kind === 'dare' && (q.micMs ?? 0) < MIC_SECONDS * 1000
  let matched: boolean
  let delta: number
  if (s.team) {
    // A couple moves on when both picked the same answer
    matched =
      s.order.every((id) => at(id) != null) &&
      new Set(s.order.map(at)).size === 1
    delta =
      q.kind === 'fight'
        ? matched
          ? EFFECT.fightSame
          : EFFECT.fightDiff
        : matched
          ? EFFECT.questionSame
          : EFFECT.questionDiff
  } else {
    // Friends: every vote counts, the points of what they picked add up
    const votes = answerersOf(s, q.by)
      .map(at)
      .filter((v): v is number => v != null)
    delta = verdict(votes, boardQuestion(q.id)?.moves ?? [0, 0, 0])
    // A dare without the mic on long enough costs MIC_PENALTY, whatever they voted
    if (noMic) delta = MIC_PENALTY
    matched = delta > 0
  }
  const from = s.pos[k] ?? 0
  const to = Math.max(0, Math.min(LAST, from + delta))
  s.seq++
  s.pos[k] = to
  s.question = null
  s.reveal = {
    seq: s.seq,
    id: q.id,
    kind: q.kind,
    by: q.by,
    answers: q.answers,
    matched,
    delta,
    from,
    to,
    ...(noMic ? { noMic: true } : {}),
  }
  const p = people.get(q.by)
  const who = nameOf(people, q.by)
  const steps = (n: number) =>
    n === 1 ? 'خطوة' : n === 2 ? 'زوز خطوات' : `${n} خطوات`
  let text: string
  if (s.team) {
    text =
      q.kind === 'fight'
        ? matched
          ? `🤝 تصالحتو! ${steps(delta)} لقدّام`
          : `⚡ عراك! ${steps(-delta)} لتالي`
        : matched
          ? `✅ نفس الجواب! ${steps(delta)} لقدّام`
          : `❌ ما تفاهمتوش، ${steps(-delta)} لتالي`
  } else {
    const icon = q.kind === 'dare' ? '🎤' : '🗳️'
    text = noMic
      ? `🔇 ${who} ما ${g(p, 'حلّش', 'حلّتش')} المايك في التحدّي: ${g(p, 'يرجع', 'ترجع')} ${steps(-delta)}`
      : delta > 0
        ? `${icon} صحاب ${who} حكمو: ${steps(delta)} لقدّام`
        : delta < 0
          ? `${icon} صحاب ${who} حكمو: ${g(p, 'يرجع', 'ترجع')} ${steps(-delta)} 😅`
          : `${icon} ما فمّاش حكم، ${who} ${g(p, 'يقعد', 'تقعد')} في ${g(p, 'بلاصتو', 'بلاصتها')}`
  }
  log(s, text, delta > 0 ? 'good' : delta < 0 ? 'bad' : 'info')
  const next =
    to === LAST
      ? s.team
        ? finish(s, q.by, people)
        : arrive(s, q.by, now, people)
      : nextTurn(s, now, people)
  // Give everyone time to read the answers before the next roll
  if (next.step === 'roll') {
    next.holdUntil = now + REVEAL_SECONDS * 1000
    next.endsAt += REVEAL_SECONDS * 1000
  }
  return next
}

/**
 * During a dare, the server looks at the voice call each time someone polls: while the
 * player who rolled has the mic on, the time since the last look adds up (gaps over 3 s,
 * when nobody looked, don't count). Returns the same state when nothing changed.
 */
export function trackMic(
  prev: BoardState,
  micOn: boolean,
  now: number,
): BoardState {
  const q = prev.question
  if (prev.team || prev.step !== 'question' || q?.kind !== 'dare' || !micOn)
    return prev
  const s = clone(prev)
  const dq = s.question!
  const gap = dq.micLast != null ? now - dq.micLast : 0
  dq.micMs = (dq.micMs ?? 0) + (gap > 0 && gap <= 3000 ? gap : 0)
  dq.micLast = now
  s.seq++
  return s
}

/** A player picks an option (0-2) on the open question; it closes once everyone has answered. */
export function answerQuestion(
  prev: BoardState,
  playerId: number,
  option: number,
  now: number,
  people: People,
): BoardState {
  const q = prev.question
  if (prev.step !== 'question' || !q) return prev
  if (
    !answerersOf(prev, q.by).includes(playerId) ||
    q.answers[String(playerId)] != null
  )
    return prev
  const s = clone(prev)
  s.question!.answers[String(playerId)] = option
  s.seq++
  const all = answerersOf(s, q.by).every(
    (id) => s.question!.answers[String(id)] != null,
  )
  return all ? resolve(s, now, people) : s
}

/** Moves the game on when a step timed out: the dice rolls itself, a question closes. */
export function tick(
  s: BoardState,
  now: number,
  people: People,
  rand: () => number,
): BoardState {
  if (s.step === 'done' || now < s.endsAt) return s
  if (s.step === 'roll')
    return applyRoll(s, 1 + Math.floor(rand() * 6), now, people, rand, true)
  return resolve(s, now, people)
}
