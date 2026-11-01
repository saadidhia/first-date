// Flouci online-payment client (server only). Docs: https://docs.flouci.com
// Base https://developers.flouci.com/api/v2, auth `Authorization: Bearer <PUBLIC>:<PRIVATE>`,
// amounts in millimes. A payment is created with generate_payment and confirmed with
// verify_payment (success === true && result.status === 'SUCCESS').

const API = process.env.FLOUCI_API_URL ?? 'https://developers.flouci.com/api/v2'

function keys() {
  const pub = process.env.FLOUCI_PUBLIC_KEY
  const priv = process.env.FLOUCI_PRIVATE_KEY
  if (!pub || !priv) return null
  return { pub, priv }
}

/** Whether Flouci credentials are set (so we can show/hide the buy-coins UI path). */
export function flouciConfigured() {
  return keys() != null
}

function authHeader() {
  const k = keys()
  if (!k) throw new Error('الدفع عبر فلوسي مازال ما تفعّلش')
  return `Bearer ${k.pub}:${k.priv}`
}

export async function flouciGeneratePayment(input: {
  amountMillimes: number
  successLink: string
  failLink: string
  trackingId: string
  webhook?: string
  acceptCard?: boolean
}): Promise<{ paymentId: string; link: string }> {
  const res = await fetch(`${API}/generate_payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      amount: String(input.amountMillimes),
      success_link: input.successLink,
      fail_link: input.failLink,
      developer_tracking_id: input.trackingId,
      accept_card: input.acceptCard ?? true,
      session_timeout_secs: 1200,
      ...(input.webhook
        ? { webhook: input.webhook, webhook_version: 2 }
        : {}),
    }),
  })
  const json = (await res.json().catch(() => null)) as {
    result?: { success?: boolean; payment_id?: string; link?: string }
  } | null
  const r = json?.result
  if (!res.ok || !r?.payment_id || !r?.link) {
    throw new Error('ما نجّمناش نحضّرو الدفع، عاود جرّب')
  }
  return { paymentId: r.payment_id, link: r.link }
}

export type FlouciStatus =
  | 'SUCCESS'
  | 'PENDING'
  | 'EXPIRED'
  | 'FAILURE'
  | 'PREAUTH_SUCCESS'
  | 'SYSTEM_FAILURE'

export async function flouciVerifyPayment(
  paymentId: string,
): Promise<{ paid: boolean; status: FlouciStatus | null; amount: number | null }> {
  const res = await fetch(
    `${API}/verify_payment/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: authHeader() } },
  )
  const json = (await res.json().catch(() => null)) as {
    success?: boolean
    result?: { status?: FlouciStatus; amount?: number }
  } | null
  const status = json?.result?.status ?? null
  return {
    paid: json?.success === true && status === 'SUCCESS',
    status,
    amount: json?.result?.amount ?? null,
  }
}
