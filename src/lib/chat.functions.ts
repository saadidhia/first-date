import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { accounts, chatMessages, friendships } from '../../db/schema'
import { requireAccountId } from './account-session'

const ONLINE_MS = 40_000

function ageOf(birthday: string): number | null {
  const d = new Date(birthday)
  if (Number.isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)))
}

/** Resolve a friend by username and confirm we're friends; returns their account. */
async function friendOrThrow(me: number, username: string) {
  const [friend] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.username, username))
    .limit(1)
  if (!friend) throw new Error('اللاعب هذا موش موجود')
  const [link] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(eq(friendships.accountId, me), eq(friendships.friendId, friend.id)),
    )
    .limit(1)
  if (!link) throw new Error('ما تنجّمش تحكي معاه قبل ما تعملو ماتش')
  return friend
}

/** My friends (matched players), with online status and unread counts. */
export const getFriends = createServerFn({ method: 'POST' }).handler(
  async () => {
    const me = await requireAccountId()
    const rows = await db
      .select({
        id: accounts.id,
        username: accounts.username,
        name: accounts.name,
        gender: accounts.gender,
        birthday: accounts.birthday,
        lastSeenAt: accounts.lastSeenAt,
      })
      .from(friendships)
      .innerJoin(accounts, eq(friendships.friendId, accounts.id))
      .where(eq(friendships.accountId, me))

    const myMessages = await db
      .select()
      .from(chatMessages)
      .where(or(eq(chatMessages.fromId, me), eq(chatMessages.toId, me)))

    const cutoff = Date.now() - ONLINE_MS
    return rows
      .map((f) => {
        const between = myMessages.filter(
          (m) =>
            (m.fromId === me && m.toId === f.id) ||
            (m.fromId === f.id && m.toId === me),
        )
        const last = between.reduce<(typeof between)[number] | null>(
          (acc, m) => (!acc || m.id > acc.id ? m : acc),
          null,
        )
        const unread = between.filter(
          (m) => m.toId === me && m.readAt == null,
        ).length
        return {
          username: f.username,
          name: f.name,
          gender: f.gender as 'male' | 'female' | null,
          age: ageOf(f.birthday),
          online: f.lastSeenAt.getTime() > cutoff,
          lastMessage: last?.body ?? null,
          lastAt: last?.createdAt.toISOString() ?? null,
          unread,
        }
      })
      .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))
  },
)

/** The conversation with one friend. Marks their messages to me as read. */
export const getConversation = createServerFn({ method: 'POST' })
  .validator(z.object({ username: z.string().trim().toLowerCase() }))
  .handler(async ({ data }) => {
    const me = await requireAccountId()
    const friend = await friendOrThrow(me, data.username)

    const msgs = await db
      .select()
      .from(chatMessages)
      .where(
        or(
          and(
            eq(chatMessages.fromId, me),
            eq(chatMessages.toId, friend.id),
          ),
          and(
            eq(chatMessages.fromId, friend.id),
            eq(chatMessages.toId, me),
          ),
        ),
      )
      .orderBy(asc(chatMessages.id))

    await db
      .update(chatMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(chatMessages.fromId, friend.id),
          eq(chatMessages.toId, me),
          isNull(chatMessages.readAt),
        ),
      )

    return {
      friend: {
        username: friend.username,
        name: friend.name,
        gender: friend.gender as 'male' | 'female' | null,
        age: ageOf(friend.birthday),
        online: friend.lastSeenAt.getTime() > Date.now() - ONLINE_MS,
      },
      messages: msgs.map((m) => ({
        id: m.id,
        mine: m.fromId === me,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    }
  })

/** Send a message to a friend. */
export const sendChat = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      username: z.string().trim().toLowerCase(),
      body: z.string().trim().min(1, 'اكتب حاجة').max(1000),
    }),
  )
  .handler(async ({ data }) => {
    const me = await requireAccountId()
    const friend = await friendOrThrow(me, data.username)
    const [msg] = await db
      .insert(chatMessages)
      .values({ fromId: me, toId: friend.id, body: data.body })
      .returning()
    return {
      id: msg.id,
      mine: true,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    }
  })
