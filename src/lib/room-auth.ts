import { and, eq } from 'drizzle-orm'

import { db } from '../../db'
import { players, rooms } from '../../db/schema'

/** The room and player behind a room code and player token. Server only: call it inside handlers. */
export async function authorize(code: string, token: string) {
  const [row] = await db
    .select({ room: rooms, player: players })
    .from(players)
    .innerJoin(rooms, eq(players.roomId, rooms.id))
    .where(and(eq(players.token, token), eq(rooms.code, code)))
    .limit(1)
  if (!row) throw new Error('ما عندكش الحق تدخل للّعبة هذي')
  return row
}
