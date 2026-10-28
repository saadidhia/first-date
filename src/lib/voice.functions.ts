import { createHmac } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { players, voiceMembers, voiceSignals } from '../../db/schema'
import { authorize } from './room-auth'

// The voice chat is open during the whole game and for 5 minutes after it ends
const VOICE_AFTER_SECONDS = 5 * 60
// A member that stopped syncing for this long has left (closed the tab, lost the network)
const MEMBER_MS = 7000
const SIGNAL_MS = 2 * 60 * 1000

/** STUN always; TURN when the server has one (coturn with `use-auth-secret`), for networks that block direct audio. */
type IceServer = { urls: string[]; username?: string; credential?: string }

function iceServers(playerId: number): IceServer[] {
  const servers: IceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const urls = process.env.TURN_URLS?.split(',').map((u) => u.trim()).filter(Boolean)
  const secret = process.env.TURN_SECRET
  if (urls?.length && secret) {
    // Short-lived credentials, the coturn REST API way: username "<expiry>:<id>", password HMAC-SHA1 of it
    const username = `${Math.floor(Date.now() / 1000) + 6 * 3600}:${playerId}`
    const credential = createHmac('sha1', secret).update(username).digest('base64')
    servers.push({ urls, username, credential })
  }
  return servers
}

const signalSchema = z.object({
  to: z.number().int(),
  data: z.object({
    type: z.enum(['offer', 'answer', 'ice']),
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
    const closesAt =
      room.phase === 'done'
        ? new Date((room.endedAt?.getTime() ?? 0) + VOICE_AFTER_SECONDS * 1000)
        : null
    const open = !closesAt || closesAt.getTime() > Date.now()

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
        const ids = new Set(roster.map((p) => p.id))
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
    }

    return {
      open,
      closesAt: closesAt?.toISOString() ?? null,
      serverNow: new Date().toISOString(),
      me: me.id,
      members,
      signals,
      iceServers: data.inCall && open ? iceServers(me.id) : [],
    }
  })
