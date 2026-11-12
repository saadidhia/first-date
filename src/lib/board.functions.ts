import { randomInt } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { players, rooms, voiceMembers } from '../../db/schema'
import { recordActivity } from './activity'
import {
  type BoardPerson,
  type BoardState,
  MIC_SECONDS,
  answerQuestion,
  answerersOf,
  applyRoll,
  boardQuestion,
  keyOf,
  lastOf,
  rollerOf,
  tick,
  trackMic,
  turnsOf,
  turnsUsed,
} from './board'
import { authorize } from './room-auth'

// The room-level server functions of ثنية العرس. The rules live in ./board.ts; here we load the
// state, apply one move, and save it only over the version we read, so two players acting at
// the same moment can't both move the pawns.

const ONLINE_MS = 9000
const authSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase()),
  token: z.string().uuid(),
})

const rand = () => randomInt(0, 1_000_000) / 1_000_000

type Room = typeof rooms.$inferSelect

async function rosterOf(roomId: number) {
  return db
    .select()
    .from(players)
    .where(eq(players.roomId, roomId))
    .orderBy(asc(players.id))
}

const peopleOf = (roster: Awaited<ReturnType<typeof rosterOf>>) =>
  new Map<number, BoardPerson>(
    roster.map((p) => [p.id, { id: p.id, name: p.name, gender: p.gender }]),
  )

/** Saves `next` if nobody changed the board since `prev` was read. */
async function save(room: Room, prev: BoardState, next: BoardState) {
  if (next === prev) return true
  const done = next.step === 'done'
  const saved = await db
    .update(rooms)
    .set({
      board: next,
      ...(done ? { phase: 'done', endedAt: new Date() } : {}),
    })
    .where(
      and(
        eq(rooms.id, room.id),
        sql`(${rooms.board}->>'seq')::int = ${prev.seq}`,
      ),
    )
    .returning({ id: rooms.id })
  return saved.length > 0
}

async function loadBoard(code: string, token: string) {
  const { room, player } = await authorize(code, token)
  if (!room.board) throw new Error('اللعبة هذي موش ثنية العرس')
  return { room, me: player, board: room.board }
}

/** Everything the board screen needs, as seen by one player. Polled every second or so. */
export const getBoardState = createServerFn({ method: 'POST' })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const { room: first, player: me } = await authorize(data.code, data.token)
    await db
      .update(players)
      .set({ lastSeenAt: new Date() })
      .where(eq(players.id, me.id))
    await recordActivity()
    const roster = await rosterOf(first.id)
    const people = peopleOf(roster)

    let room = first
    // A step that timed out moves on here (the dice rolls itself, a question closes)
    if (room.board && room.board.step !== 'done') {
      const next = tick(room.board, Date.now(), people, rand)
      if (next !== room.board && (await save(room, room.board, next))) {
        const [fresh] = await db
          .select()
          .from(rooms)
          .where(eq(rooms.id, room.id))
        room = fresh
      }
    }

    // A dare is done out loud: while the player who rolled has the mic on in the call, their
    // mic time adds up (the voice call refreshes their row about every second)
    const dare =
      room.board?.step === 'question' && room.board.question?.kind === 'dare'
    if (room.board && dare && room.board.question) {
      const [mic] = await db
        .select({ muted: voiceMembers.muted, seenAt: voiceMembers.seenAt })
        .from(voiceMembers)
        .where(eq(voiceMembers.playerId, room.board.question.by))
        .limit(1)
      const micOn =
        !!mic && !mic.muted && Date.now() - mic.seenAt.getTime() < 3000
      const next = trackMic(room.board, micOn, Date.now())
      if (next !== room.board && (await save(room, room.board, next)))
        room = { ...room, board: next }
    }

    const b = room.board
    const others = roster.filter((p) => p.id !== me.id)
    // Friends questions are about the player who rolled, so they're worded for them
    const about = (id: number) => {
      const p = roster.find((x) => x.id === id)
      return p ? { name: p.name, gender: p.gender } : null
    }
    const q = b?.question
      ? boardQuestion(b.question.id, me.gender, about(b.question.by))
      : null
    const r = b?.reveal
      ? boardQuestion(b.reveal.id, me.gender, about(b.reveal.by))
      : null
    return {
      code: room.code,
      mode:
        room.mode === 'board_friends'
          ? ('board_friends' as const)
          : ('board' as const),
      phase: room.phase as 'waiting' | 'board' | 'done',
      serverNow: Date.now(),
      maxPlayers: room.mode === 'board_friends' ? 4 : 2,
      maxTurns: turnsOf(room.mode !== 'board_friends'),
      last: lastOf(room.mode !== 'board_friends'),
      me: {
        id: me.id,
        name: me.name,
        gender: me.gender,
        host: me.role === 'host',
      },
      players: roster.map((p) => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        host: p.role === 'host',
        online:
          p.id === me.id || Date.now() - p.lastSeenAt.getTime() < ONLINE_MS,
      })),
      others: others.map((p) => ({ id: p.id, name: p.name, gender: p.gender })),
      board: b
        ? {
            team: b.team,
            order: b.order,
            turnOf: b.step === 'roll' ? rollerOf(b) : null,
            turns: turnsUsed(b),
            rolls: b.rolls,
            pos: b.pos,
            step: b.step,
            endsAt: b.endsAt,
            roll: b.roll,
            // The open question in my wording; other players' answers stay hidden until it closes
            question:
              b.question && q
                ? {
                    seq: b.question.seq,
                    kind: b.question.kind,
                    by: b.question.by,
                    text: q.text,
                    options: q.options,
                    // Each option's points: only the player who rolled sees them, the voters never do
                    moves: b.question.by === me.id ? q.moves : null,
                    // Who answers: both of a couple; with friends, all but the player who rolled
                    answerers: answerersOf(b, b.question.by),
                    answered: Object.keys(b.question.answers).map(Number),
                    // Dares: seconds the player who rolled has had the mic on, out of MIC_SECONDS
                    micSeconds: Math.floor((b.question.micMs ?? 0) / 1000),
                    micNeeded: MIC_SECONDS,
                    mine: b.question.answers[String(me.id)] ?? null,
                  }
                : null,
            reveal:
              b.reveal && r
                ? {
                    seq: b.reveal.seq,
                    kind: b.reveal.kind,
                    by: b.reveal.by,
                    text: r.text,
                    options: r.options,
                    // Each option's points: only the player who rolled sees them, never the voters
                    moves: b.reveal.by === me.id ? r.moves : null,
                    answers: b.reveal.answers,
                    matched: b.reveal.matched,
                    delta: b.reveal.delta,
                    noMic: !!b.reveal.noMic,
                    // The square the question was played on, for the board's history
                    square: b.reveal.from,
                  }
                : null,
            log: b.log,
            result: b.result,
            // A couple's 🚧 obstacle on the last roll, if they hit one
            obstacle:
              b.obstacle && b.obstacle.seq === b.roll?.seq
                ? { text: b.obstacle.text, move: b.obstacle.move ?? -2 }
                : null,
            // Nobody rolls before this: time to read the last question's answers
            holdUntil: b.holdUntil ?? 0,
            // Friends who reached 👑 الكرسي, in order of arrival
            finished: b.finished ?? [],
            myKey: keyOf(b, me.id),
          }
        : null,
    }
  })

/** The player whose turn it is rolls the dice. */
export const rollDice = createServerFn({ method: 'POST' })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const { room, me, board } = await loadBoard(data.code, data.token)
    if (board.step !== 'roll') throw new Error('موش وقت الزهر توّا')
    if (rollerOf(board) !== me.id) throw new Error('موش دورك 😅')
    if (board.holdUntil && Date.now() < board.holdUntil)
      throw new Error('استنّى شويّة، شوفو الأجوبة 👀')
    const people = peopleOf(await rosterOf(room.id))
    const next = applyRoll(board, randomInt(1, 7), Date.now(), people, rand)
    if (!(await save(room, board, next))) throw new Error('استنّى شويّة وعاود')
    return { ok: true }
  })

/** A player answers the open question (option 0-2). */
export const answerBoard = createServerFn({ method: 'POST' })
  .validator(
    authSchema.extend({
      seq: z.number().int(),
      option: z.number().int().min(0).max(2),
    }),
  )
  .handler(async ({ data }) => {
    const { room, me, board } = await loadBoard(data.code, data.token)
    if (board.step !== 'question' || board.question?.seq !== data.seq)
      throw new Error('الوقت فات على السؤال هذا ⏱')
    if (board.question.answers[String(me.id)] != null) return { ok: true }
    const people = peopleOf(await rosterOf(room.id))
    // Another answer may land in the same instant: read again and retry a couple of times
    let current = board
    for (let attempt = 0; attempt < 3; attempt++) {
      const next = answerQuestion(
        current,
        me.id,
        data.option,
        Date.now(),
        people,
      )
      if (await save(room, current, next)) return { ok: true }
      const [fresh] = await db.select().from(rooms).where(eq(rooms.id, room.id))
      if (!fresh?.board || fresh.board.question?.seq !== data.seq)
        throw new Error('الوقت فات على السؤال هذا ⏱')
      current = fresh.board
    }
    throw new Error('استنّى شويّة وعاود')
  })
