// Server-only coin crediting. Kept out of coins.functions.ts (which the client imports
// for its server-fn RPC bridges) so these server-only imports never reach the client.
import { and, eq, sql } from 'drizzle-orm'

import { db } from '../../db'
import { accounts, payments, walletTx } from '../../db/schema'
import { flouciVerifyPayment } from './flouci'

/**
 * Verifies a payment with Flouci and credits the coins exactly once. Safe to call from
 * the return page and the webhook: the conditional UPDATE claims the row, so a replay
 * can't double-credit, and Flouci's verify_payment is authoritative (a spoofed webhook
 * can never credit).
 */
export async function creditPaymentIfPaid(trackingId: string) {
  const [p] = await db
    .select()
    .from(payments)
    .where(eq(payments.trackingId, trackingId))
    .limit(1)
  if (!p) return { found: false as const }
  if (p.status === 'paid')
    return { found: true as const, status: 'paid' as const }
  if (!p.providerRef)
    return { found: true as const, status: p.status as 'pending' | 'failed' }

  const verdict = await flouciVerifyPayment(p.providerRef)
  if (verdict.paid) {
    await db.transaction(async (tx) => {
      const [claim] = await tx
        .update(payments)
        .set({ status: 'paid', paidAt: new Date() })
        .where(and(eq(payments.id, p.id), eq(payments.status, 'pending')))
        .returning()
      if (!claim) return // already credited by another call / the webhook
      await tx
        .update(accounts)
        .set({ coins: sql`${accounts.coins} + ${p.coins}` })
        .where(eq(accounts.id, p.accountId))
      await tx.insert(walletTx).values({
        accountId: p.accountId,
        amount: p.coins,
        reason: 'topup',
      })
    })
    return { found: true as const, status: 'paid' as const, added: p.coins }
  }
  if (
    verdict.status === 'FAILURE' ||
    verdict.status === 'EXPIRED' ||
    verdict.status === 'SYSTEM_FAILURE'
  ) {
    await db
      .update(payments)
      .set({ status: 'failed' })
      .where(and(eq(payments.id, p.id), eq(payments.status, 'pending')))
    return { found: true as const, status: 'failed' as const }
  }
  return { found: true as const, status: 'pending' as const }
}
