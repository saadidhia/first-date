import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { accounts, coinVouchers, payments, walletTx } from '../../db/schema'
import { requireAccountId } from './account-session'
import { getAdminEmail } from './admin-session'
import { packById } from './coin-packs'
import { flouciConfigured, flouciGeneratePayment } from './flouci'
import { creditPaymentIfPaid } from './coins.server'

// Unambiguous alphabet (no 0/O/1/I) for codes people type by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function makeCode() {
  const part = (n: number) =>
    Array.from(
      { length: n },
      () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
    ).join('')
  return `FD-${part(4)}-${part(4)}`
}

const normalize = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '')

function requireAdmin() {
  if (!getAdminEmail()) throw new Error('ما عندكش الحق')
}

/** A player redeems a coin voucher to top up their balance. */
export const redeemVoucher = createServerFn({ method: 'POST' })
  .validator(z.object({ code: z.string().trim().min(1).max(40) }))
  .handler(async ({ data }) => {
    const me = requireAccountId()
    const code = normalize(data.code)
    return db.transaction(async (tx) => {
      // Claim the voucher atomically: only an unused one flips, so it can't be redeemed twice
      const [voucher] = await tx
        .update(coinVouchers)
        .set({ redeemedBy: me, redeemedAt: new Date() })
        .where(and(eq(coinVouchers.code, code), isNull(coinVouchers.redeemedBy)))
        .returning()
      if (!voucher) {
        const [exists] = await tx
          .select({ id: coinVouchers.id })
          .from(coinVouchers)
          .where(eq(coinVouchers.code, code))
          .limit(1)
        throw new Error(exists ? 'الكود مستعمل ديجا 🙃' : 'الكود غالط')
      }
      const [acc] = await tx
        .update(accounts)
        .set({ coins: sql`${accounts.coins} + ${voucher.coins}` })
        .where(eq(accounts.id, me))
        .returning({ coins: accounts.coins })
      await tx.insert(walletTx).values({
        accountId: me,
        amount: voucher.coins,
        reason: 'voucher',
      })
      return { added: voucher.coins, coins: acc.coins }
    })
  })

/** Admin: generate a batch of unused voucher codes. */
export const adminCreateVouchers = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      coins: z.number().int().min(1).max(1_000_000),
      count: z.number().int().min(1).max(200),
      note: z.string().trim().max(60).optional(),
    }),
  )
  .handler(async ({ data }) => {
    requireAdmin()
    const codes: string[] = []
    for (let i = 0; i < data.count; i++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = makeCode()
        const [row] = await db
          .insert(coinVouchers)
          .values({ code, coins: data.coins, note: data.note })
          .onConflictDoNothing()
          .returning({ code: coinVouchers.code })
        if (row) {
          codes.push(row.code)
          break
        }
      }
    }
    return { codes }
  })

/** Admin: add coins straight to an account (e.g. after a manual payment). */
export const adminTopUp = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      username: z.string().trim().toLowerCase(),
      coins: z.number().int().min(1).max(1_000_000),
    }),
  )
  .handler(async ({ data }) => {
    requireAdmin()
    const [acc] = await db
      .update(accounts)
      .set({ coins: sql`${accounts.coins} + ${data.coins}` })
      .where(eq(accounts.username, data.username))
      .returning({ id: accounts.id, name: accounts.name, coins: accounts.coins })
    if (!acc) throw new Error('اللاعب هذا موش موجود')
    await db.insert(walletTx).values({
      accountId: acc.id,
      amount: data.coins,
      reason: 'admin_topup',
    })
    return { name: acc.name, coins: acc.coins }
  })

// ---------------------------------------------------------------------------
// Buying coins with real money via Flouci (D17, wallets, e-DINAR, cards).
// ---------------------------------------------------------------------------

function baseUrl() {
  const env = process.env.PUBLIC_BASE_URL
  if (env) return env.replace(/\/$/, '')
  const proto = getRequestHeader('x-forwarded-proto') ?? 'http'
  const host = getRequestHeader('host') ?? 'localhost:3000'
  return `${proto}://${host}`
}

/** Whether buying coins with money is available (Flouci configured). */
export const coinShopEnabled = createServerFn({ method: 'GET' }).handler(
  async () => ({ enabled: flouciConfigured() }),
)

/** Start a Flouci payment for a coin pack; returns the checkout link to redirect to. */
export const startCoinPurchase = createServerFn({ method: 'POST' })
  .validator(z.object({ packId: z.string().trim().max(20) }))
  .handler(async ({ data }) => {
    const me = requireAccountId()
    const pack = packById(data.packId)
    if (!pack) throw new Error('الباكيج هذا موش موجود')
    if (!flouciConfigured()) throw new Error('الدفع عبر فلوسي مازال ما تفعّلش')

    const trackingId = crypto.randomUUID()
    await db.insert(payments).values({
      accountId: me,
      provider: 'flouci',
      trackingId,
      packId: pack.id,
      coins: pack.coins,
      amountMillimes: pack.millimes,
    })

    const base = baseUrl()
    const { paymentId, link } = await flouciGeneratePayment({
      amountMillimes: pack.millimes,
      successLink: `${base}/matchy/pay?t=${trackingId}`,
      failLink: `${base}/matchy/pay?t=${trackingId}&r=fail`,
      webhook: `${base}/api/flouci-webhook`,
      trackingId,
      acceptCard: true,
    })
    await db
      .update(payments)
      .set({ providerRef: paymentId })
      .where(eq(payments.trackingId, trackingId))
    return { link }
  })

/** The /matchy/pay page calls this on return from Flouci to confirm and credit. */
export const confirmCoinPurchase = createServerFn({ method: 'POST' })
  .validator(z.object({ t: z.string().trim().min(1).max(60) }))
  .handler(async ({ data }) => {
    const me = requireAccountId()
    const [p] = await db
      .select()
      .from(payments)
      .where(eq(payments.trackingId, data.t))
      .limit(1)
    if (!p || p.accountId !== me) throw new Error('الدفع هذا موش موجود')

    const r = await creditPaymentIfPaid(data.t)
    const [acc] = await db
      .select({ coins: accounts.coins })
      .from(accounts)
      .where(eq(accounts.id, me))
      .limit(1)
    return {
      status: r.found ? r.status : 'failed',
      coins: acc?.coins ?? 0,
      added: 'added' in r ? r.added : null,
      pack: { coins: p.coins, millimes: p.amountMillimes },
    }
  })

/** Admin: the latest vouchers, with who redeemed each (if anyone). */
export const adminListVouchers = createServerFn({ method: 'GET' }).handler(
  async () => {
    requireAdmin()
    const rows = await db
      .select({
        code: coinVouchers.code,
        coins: coinVouchers.coins,
        note: coinVouchers.note,
        redeemedAt: coinVouchers.redeemedAt,
        redeemedByName: accounts.name,
        createdAt: coinVouchers.createdAt,
      })
      .from(coinVouchers)
      .leftJoin(accounts, eq(coinVouchers.redeemedBy, accounts.id))
      .orderBy(desc(coinVouchers.id))
      .limit(100)
    const [[{ unused }], [{ redeemed }]] = await Promise.all([
      db
        .select({ unused: sql<number>`count(*)::int` })
        .from(coinVouchers)
        .where(isNull(coinVouchers.redeemedBy)),
      db
        .select({ redeemed: sql<number>`count(*)::int` })
        .from(coinVouchers)
        .where(sql`${coinVouchers.redeemedBy} is not null`),
    ])
    return {
      unused,
      redeemed,
      vouchers: rows.map((r) => ({
        code: r.code,
        coins: r.coins,
        note: r.note,
        redeemedBy: r.redeemedByName,
        redeemedAt: r.redeemedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  },
)
