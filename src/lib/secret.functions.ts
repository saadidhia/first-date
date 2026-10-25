import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { secretMessages } from '../../db/schema'
import { getAdminEmail } from './admin-session'

// The app a link was opened from: in-app browsers add their name to the user agent
function sourceFromUserAgent(ua: string) {
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook'
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return 'TikTok'
  if (/Snapchat/i.test(ua)) return 'Snapchat'
  if (/WhatsApp/i.test(ua)) return 'WhatsApp'
  return null
}

// Caps how many messages the whole inbox takes per minute, so a script can't flood it
const MAX_PER_MINUTE = 20

export const sendSecretMessage = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      body: z.string().trim().min(1, { error: 'اكتب رسالتك 🙂' }).max(1000, { error: 'الرسالة طويلة برشا' }),
      // Honeypot field, hidden from people; bots fill it in
      website: z.string().max(0).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const [{ recent }] = await db
      .select({ recent: sql<number>`count(*)::int` })
      .from(secretMessages)
      .where(gt(secretMessages.createdAt, new Date(Date.now() - 60_000)))
    if (recent >= MAX_PER_MINUTE) throw new Error('برشا رسائل توّا، عاود بعد دقيقة 🙏')
    await db.insert(secretMessages).values({ body: data.body, source: sourceFromUserAgent(getRequestHeader('user-agent') ?? '') })
    return { ok: true }
  })

function requireAdmin() {
  if (!getAdminEmail()) throw new Error('ما عندكش الحق تشوف الصفحة هذي')
}

export const getSecretMessages = createServerFn({ method: 'GET' }).handler(async () => {
  requireAdmin()
  const rows = await db
    .select()
    .from(secretMessages)
    .orderBy(desc(secretMessages.createdAt))
    .limit(300)
  return rows.map((m) => ({
    id: m.id,
    instagram: m.instagram,
    source: m.source,
    body: m.body,
    unread: m.readAt == null,
    createdAt: m.createdAt.toISOString(),
  }))
})

export const markSecretMessagesRead = createServerFn({ method: 'POST' }).handler(async () => {
  requireAdmin()
  await db.update(secretMessages).set({ readAt: new Date() }).where(isNull(secretMessages.readAt))
  return { ok: true }
})

export const deleteSecretMessage = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    requireAdmin()
    await db.delete(secretMessages).where(eq(secretMessages.id, data.id))
    return { ok: true }
  })
