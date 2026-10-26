import { db } from '../../db'
import { activityMinutes } from '../../db/schema'

// Minute this server already saved, so each poll doesn't write again
let savedMinute = 0

/** Marks the current minute as having someone on the site. */
export async function recordActivity() {
  const minute = Math.floor(Date.now() / 60_000) * 60_000
  if (minute === savedMinute) return
  savedMinute = minute
  await db
    .insert(activityMinutes)
    .values({ minute: new Date(minute) })
    .onConflictDoNothing()
    .catch(() => {
      savedMinute = 0
    })
}

