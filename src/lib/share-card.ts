/**
 * Builds a 1080×1920 story image of a game result (the score and a short line, never anyone's
 * answers). The room shows it in a preview, then shares it (phones) or downloads it. Browser only.
 */

export type ShareCardInput = {
  mode: 'date' | 'friends'
  /** Small line above the names, e.g. "التفاهم بيناتنا" */
  label: string
  /** e.g. "سارة 💘 أحمد" */
  names: string
  score: number
  /** What the ring shows in its middle instead of "score%" (a medal, a number of turns) */
  big?: string
  /** How full the ring is, 0 to 1 (defaults to score / 100) */
  progress?: number
  /** e.g. "💞 تفاهم كبير" */
  line: string
  /** Optional second line, e.g. a group title */
  extra?: string
  /** Call to action at the bottom */
  cta: string
}

const W = 1080
const H = 1920
const BG = '#141a2e'
const RED = '#e0324a'
const GOLD = '#e9b949'
const BLUE = '#2f7fd1'
const BODY = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif'
const HEAD = '"Readex Pro", "IBM Plex Sans Arabic", sans-serif'

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load(`700 120px ${HEAD}`),
      document.fonts.load(`600 60px ${BODY}`),
    ])
  } catch {
    // Falls back to the system font: still readable
  }
}

/** Splits text on spaces into lines that fit `max` pixels. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > max && line) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: string,
  color: string,
  lineHeight: number,
  max = W - 160,
) {
  ctx.font = font
  ctx.fillStyle = color
  const lines = wrap(ctx, text, max)
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lineHeight))
  return y + lines.length * lineHeight
}

export async function makeShareCard(input: ShareCardInput): Promise<Blob> {
  await loadFonts()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const accent = input.mode === 'date' ? RED : BLUE

  // Night background with a warm glow behind the score
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 860, 40, W / 2, 860, 900)
  glow.addColorStop(0, `${accent}66`)
  glow.addColorStop(1, `${BG}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // A light zellige-like dot pattern
  ctx.fillStyle = 'rgba(233, 185, 73, 0.06)'
  for (let y = 40; y < H; y += 72)
    for (let x = (y / 72) % 2 ? 76 : 40; x < W; x += 72) {
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    }

  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  drawText(
    ctx,
    '🇹🇳 First Date على الطريقة التونسية',
    200,
    `600 46px ${BODY}`,
    GOLD,
    60,
  )
  drawText(
    ctx,
    input.label,
    360,
    `600 50px ${BODY}`,
    'rgba(255,255,255,0.75)',
    64,
  )
  drawText(ctx, input.names, 450, `700 78px ${HEAD}`, '#ffffff', 96)

  // Score ring
  const cx = W / 2
  const cy = 860
  const r = 270
  ctx.lineCap = 'round'
  ctx.lineWidth = 36
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  ring.addColorStop(0, accent)
  ring.addColorStop(1, GOLD)
  ctx.strokeStyle = ring
  const pct = Math.max(0, Math.min(1, input.progress ?? input.score / 100))
  ctx.beginPath()
  ctx.arc(
    cx,
    cy,
    r,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * Math.max(pct, 0.01),
  )
  ctx.stroke()
  ctx.direction = 'ltr'
  ctx.font = `700 210px ${HEAD}`
  ctx.fillStyle = '#ffffff'
  ctx.fillText(input.big ?? `${input.score}%`, cx, cy + 10)
  ctx.direction = 'rtl'

  const y = drawText(ctx, input.line, 1250, `700 64px ${HEAD}`, '#ffffff', 84)
  if (input.extra)
    drawText(ctx, input.extra, y + 30, `600 50px ${BODY}`, GOLD, 66)

  // Bottom call to action
  const boxY = 1560
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.roundRect(100, boxY, W - 200, 230, 48)
  ctx.fill()
  drawText(ctx, input.cta, boxY + 80, `600 52px ${BODY}`, '#ffffff', 64)
  ctx.direction = 'ltr'
  drawText(ctx, window.location.host, boxY + 165, `700 46px ${BODY}`, GOLD, 60)

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('ما نجّمناش نعملو الصورة'))),
      'image/png',
    ),
  )
}

const FILE_NAME = 'first-date-tunisie.png'

/**
 * Whether to offer the phone's share sheet. Only on touch devices: on a laptop the sheet
 * has no Instagram story, so we offer a download instead.
 */
export function canShareImage(blob: Blob) {
  if (typeof window === 'undefined') return false
  if (!window.matchMedia?.('(pointer: coarse)').matches) return false
  const file = new File([blob], FILE_NAME, { type: 'image/png' })
  return !!navigator.canShare?.({ files: [file] })
}

/** Opens the share sheet with the image. Resolves false if the player closed it. */
export async function shareImage(blob: Blob, text: string) {
  const file = new File([blob], FILE_NAME, { type: 'image/png' })
  try {
    await navigator.share({ files: [file], text })
    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false
    throw err
  }
}

export function downloadImage(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = FILE_NAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
