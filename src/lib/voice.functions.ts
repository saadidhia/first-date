import { createHmac } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { players, rooms, voiceListeners, voiceMembers, voiceSignals } from '../../db/schema'
import { getAdminEmail } from './admin-session'
import { authorize } from './room-auth'

// The voice chat is open during the whole game and for 5 minutes after it ends
const VOICE_AFTER_SECONDS = 5 * 60
// A member that stopped syncing for this long has left (closed the tab, lost the network)
const MEMBER_MS = 7000
const SIGNAL_MS = 2 * 60 * 1000

/** STUN always; TURN when the server has one (coturn with `use-auth-secret`), for networks that block direct audio. */
type IceServer = { urls: string[]; username?: string; credential?: string }

function iceServers(who: number | string): IceServer[] {
  const servers: IceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const urls = process.env.TURN_URLS?.split(',').map((u) => u.trim()).filter(Boolean)
  const secret = process.env.TURN_SECRET
  if (urls?.length && secret) {
    // Short-lived credentials, the coturn REST API way: username "<expiry>:<id>", password HMAC-SHA1 of it
    const username = `${Math.floor(Date.now() / 1000) + 6 * 3600}:${who}`
    const credential = createHmac('sha1', secret).update(username).digest('base64')
    servers.push({ urls, username, credential })
  }
  return servers
}

/** When the room's voice chat closes (null while the game runs) and whether it is still open. */
function voiceWindow(room: { phase: string; endedAt: Date | null }) {
  const closesAt =
    room.phase === 'done' ? new Date((room.endedAt?.getTime() ?? 0) + VOICE_AFTER_SECONDS * 1000) : null
  return { closesAt, open: !closesAt || closesAt.getTime() > Date.now() }
}

/** Admins listening to the room's call right now, as their signal address (minus the listener id). */
async function listenersOf(roomId: number) {
  const rows = await db
    .select({ id: voiceListeners.id })
    .from(voiceListeners)
    .where(and(eq(voiceListeners.roomId, roomId), gt(voiceListeners.seenAt, new Date(Date.now() - MEMBER_MS))))
    .orderBy(asc(voiceListeners.id))
  return rows.map((r) => -r.id)
}

const signalSchema = z.object({
  to: z.number().int(),
  data: z.object({
    type: z.enum(['offer', 'answer', 'ice', 'hello']),
    sid: z.string().max(64),
    sdp: z.string().max(20_000).optional(),
    candidate: z
      .object({
        candidate: z.string().max(1000).optional(),
        sdpMid: z.string().max(64).nullable().optional(),
        sdpMLineIndex: z.number().int().nullable().optional(),
        usernameFragment: z.string().max(256).nullable().optional(),
      })
      .optional(),
  }),
})

/**
 * One call does everything the voice chat needs, polled by every player of the room:
 * says whether I'm in the call (muted / speaking), sends my WebRTC messages to the others,
 * and returns who is in the call plus the messages sent to me since `since`.
 */
export const voiceSync = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      code: z.string().trim().transform((s) => s.toUpperCase()),
      token: z.string().uuid(),
      inCall: z.boolean(),
      muted: z.boolean().default(false),
      speaking: z.boolean().default(false),
      since: z.number().int().min(0).default(0),
      out: z.array(signalSchema).max(60).default([]),
    }),
  )
  .handler(async ({ data }) => {
    const { room, player: me } = await authorize(data.code, data.token)
    const { closesAt, open } = voiceWindow(room)
    const listeners = open ? await listenersOf(room.id) : []

    if (!open || !data.inCall) {
      await db.delete(voiceMembers).where(eq(voiceMembers.playerId, me.id))
    } else {
      const row = { muted: data.muted, speaking: data.speaking && !data.muted, seenAt: new Date() }
      await db
        .insert(voiceMembers)
        .values({ playerId: me.id, roomId: room.id, ...row })
        .onConflictDoUpdate({ target: voiceMembers.playerId, set: row })
      if (data.out.length) {
        const roster = await db.select({ id: players.id }).from(players).where(eq(players.roomId, room.id))
        const ids = new Set([...roster.map((p) => p.id), ...listeners])
        const out = data.out.filter((s) => s.to !== me.id && ids.has(s.to))
        if (out.length)
          await db
            .insert(voiceSignals)
            .values(out.map((s) => ({ roomId: room.id, fromId: me.id, toId: s.to, data: s.data })))
      }
    }

    const fresh = new Date(Date.now() - MEMBER_MS)
    const members = open
      ? await db
          .select({
            id: voiceMembers.playerId,
            muted: voiceMembers.muted,
            speaking: voiceMembers.speaking,
          })
          .from(voiceMembers)
          .where(and(eq(voiceMembers.roomId, room.id), gt(voiceMembers.seenAt, fresh)))
          .orderBy(asc(voiceMembers.playerId))
      : []

    const signals =
      open && data.inCall
        ? await db
            .select({ id: voiceSignals.id, from: voiceSignals.fromId, data: voiceSignals.data })
            .from(voiceSignals)
            .where(
              and(
                eq(voiceSignals.toId, me.id),
                gt(voiceSignals.id, data.since),
                gt(voiceSignals.createdAt, new Date(Date.now() - SIGNAL_MS)),
              ),
            )
            .orderBy(asc(voiceSignals.id))
            .limit(200)
        : []

    // Housekeeping: old setup messages are useless, and members who vanished leave
    if (Math.random() < 0.1) {
      await db
        .delete(voiceSignals)
        .where(and(eq(voiceSignals.roomId, room.id), lt(voiceSignals.createdAt, new Date(Date.now() - SIGNAL_MS))))
      const gone = await db
        .select({ id: voiceMembers.playerId })
        .from(voiceMembers)
        .where(and(eq(voiceMembers.roomId, room.id), lt(voiceMembers.seenAt, fresh)))
      if (gone.length) await db.delete(voiceMembers).where(inArray(voiceMembers.playerId, gone.map((g) => g.id)))
      await db
        .delete(voiceListeners)
        .where(and(eq(voiceListeners.roomId, room.id), lt(voiceListeners.seenAt, fresh)))
    }

    return {
      open,
      closesAt: closesAt?.toISOString() ?? null,
      serverNow: new Date().toISOString(),
      me: me.id,
      members,
      // The listeners are kept server-side only (in `ids`, so replies route to them): nothing about
      // them is returned to the player's browser, so a player can't tell anyone is listening in
      signals,
      iceServers: data.inCall && open ? iceServers(me.id) : [],
    }
  })

/**
 * An admin listening to a room's call, polled by the admin page while listening. The first call
 * (`listener` 0) creates the listener; then it keeps it alive, relays its WebRTC messages and
 * returns who is in the call. `leave` ends it.
 */
export const adminVoiceSync = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      code: z.string().trim().transform((s) => s.toUpperCase()),
      listener: z.number().int().min(0).default(0),
      leave: z.boolean().default(false),
      since: z.number().int().min(0).default(0),
      out: z.array(signalSchema).max(60).default([]),
    }),
  )
  .handler(async ({ data }) => {
    if (!getAdminEmail()) throw new Error('ما عندكش الحق تشوف الصفحة هذي')
    const [room] = await db.select().from(rooms).where(eq(rooms.code, data.code)).limit(1)
    if (!room) throw new Error('اللعبة هذي ما لقيناهاش')
    const { open } = voiceWindow(room)

    if (data.leave || !open) {
      if (data.listener)
        await db
          .delete(voiceListeners)
          .where(and(eq(voiceListeners.id, data.listener), eq(voiceListeners.roomId, room.id)))
      return { open, listener: 0, members: [], signals: [], iceServers: [] }
    }

    const [kept] = data.listener
      ? await db
          .update(voiceListeners)
          .set({ seenAt: new Date() })
          .where(and(eq(voiceListeners.id, data.listener), eq(voiceListeners.roomId, room.id)))
          .returning({ id: voiceListeners.id })
      : []
    // A new listener (or one that was cleaned up meanwhile) starts over with a fresh address
    const listener = kept?.id ?? (await db.insert(voiceListeners).values({ roomId: room.id }).returning())[0].id
    const me = -listener

    if (kept && data.out.length) {
      const roster = await db.select({ id: players.id }).from(players).where(eq(players.roomId, room.id))
      const ids = new Set(roster.map((p) => p.id))
      const out = data.out.filter((s) => ids.has(s.to))
      if (out.length)
        await db
          .insert(voiceSignals)
          .values(out.map((s) => ({ roomId: room.id, fromId: me, toId: s.to, data: s.data })))
    }

    const members = await db
      .select({ id: voiceMembers.playerId, muted: voiceMembers.muted, speaking: voiceMembers.speaking })
      .from(voiceMembers)
      .where(and(eq(voiceMembers.roomId, room.id), gt(voiceMembers.seenAt, new Date(Date.now() - MEMBER_MS))))
      .orderBy(asc(voiceMembers.playerId))

    const signals = kept
      ? await db
          .select({ id: voiceSignals.id, from: voiceSignals.fromId, data: voiceSignals.data })
          .from(voiceSignals)
          .where(
            and(
              eq(voiceSignals.toId, me),
              gt(voiceSignals.id, data.since),
              gt(voiceSignals.createdAt, new Date(Date.now() - SIGNAL_MS)),
            ),
          )
          .orderBy(asc(voiceSignals.id))
          .limit(200)
      : []

    return { open, listener, members, signals, iceServers: iceServers('admin') }
  })
