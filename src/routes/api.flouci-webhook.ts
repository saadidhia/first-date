import { createFileRoute } from '@tanstack/react-router'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'

import { db } from '../../db'
import { payments } from '../../db/schema'
import { creditPaymentIfPaid } from '@/lib/coins.server'

// Flouci payment webhook. We set webhook_version 2, so Flouci POSTs a signed JSON body.
// Crediting re-verifies with Flouci's verify_payment (authoritative), so a spoofed call
// can never credit coins; the signature check is a first gate to avoid wasted work.

function signatureOk(raw: string, header: string | null) {
  const priv = process.env.FLOUCI_PRIVATE_KEY
  if (!priv || !header) return false
  // header: "t=<unix>,v1=<hex hmac>"
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.split('=').map((s) => s.trim())),
  ) as { t?: string; v1?: string }
  if (!parts.t || !parts.v1) return false
  const expected = createHmac('sha256', priv)
    .update(`${parts.t}.${raw}`)
    .digest('hex')
  try {
    return timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected))
  } catch {
    return false
  }
}

async function settle(trackingId: string) {
  try {
    await creditPaymentIfPaid(trackingId)
  } catch {
    // verify may fail transiently; Flouci retries, and the return page also confirms
  }
}

export const Route = createFileRoute('/api/flouci-webhook')({
  server: {
    handlers: {
      // v2: signed POST with the payment details in the JSON body
      POST: async ({ request }) => {
        const raw = await request.text()
        if (!signatureOk(raw, request.headers.get('x-flouci-signature')))
          return new Response(null, { status: 401 })
        let tracking: string | undefined
        try {
          tracking = (JSON.parse(raw) as { developer_tracking_id?: string })
            .developer_tracking_id
        } catch {
          return new Response(null, { status: 400 })
        }
        if (tracking) await settle(tracking)
        return new Response(null, { status: 200 })
      },
      // v1 fallback: GET ?payment_id=&success=
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const paymentId = url.searchParams.get('payment_id')
        if (paymentId) {
          const [p] = await db
            .select({ trackingId: payments.trackingId })
            .from(payments)
            .where(eq(payments.providerRef, paymentId))
            .limit(1)
          if (p) await settle(p.trackingId)
        }
        return new Response(null, { status: 200 })
      },
    },
  },
})
