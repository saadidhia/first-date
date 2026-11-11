import { useSyncExternalStore } from 'react'

/**
 * Short game sounds (reveal, match, streak, timer, wheel, reactions), synthesised with the Web
 * Audio API so there are no files to load. On by default; the choice is remembered per browser
 * in `firstdate:sfx:on`. Browsers only let audio start after a tap, so the context is resumed on
 * the first pointerdown; sounds asked for before that are just skipped.
 */

export type Sfx =
  | 'question'
  | 'reveal'
  | 'match'
  | 'streak'
  | 'halfway'
  | 'tick'
  | 'timeup'
  | 'spin'
  | 'reaction'
  | 'done'

const KEY = 'firstdate:sfx:on'
const VOLUME = 0.22

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = read()
const listeners = new Set<() => void>()

function read() {
  try {
    return typeof window === 'undefined' || localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setSfxOn(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // private mode: the switch still works for this page
  }
  listeners.forEach((l) => l())
  if (on) playSfx('reaction')
}

export function useSfxOn() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => enabled,
    () => true,
  )
}

function audio() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = VOLUME
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

if (typeof window !== 'undefined') {
  // Unlock audio on the first tap anywhere (iOS / Chrome autoplay rules)
  const unlock = () => {
    audio()
    window.removeEventListener('pointerdown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
}

type ToneOpts = {
  type?: OscillatorType
  gain?: number
  slideTo?: number
}

function tone(
  a: AudioContext,
  freq: number,
  at: number,
  dur: number,
  { type = 'sine', gain = 0.6, slideTo }: ToneOpts = {},
) {
  const osc = a.createOscillator()
  const env = a.createGain()
  const t = a.currentTime + at
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(env).connect(master!)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

// The wheel turns for 4.5 s and slows down (ease-out): one click per segment it passes
const WHEEL_SECONDS = 4.4
const WHEEL_CLICKS = 36

export function playSfx(name: Sfx) {
  if (!enabled) return
  const a = audio()
  if (!a || a.state !== 'running') return
  switch (name) {
    case 'question':
      tone(a, 520, 0, 0.12, { gain: 0.35 })
      tone(a, 780, 0.07, 0.14, { gain: 0.25 })
      break
    case 'reveal':
      tone(a, 660, 0, 0.14, { type: 'triangle', gain: 0.4 })
      tone(a, 880, 0.09, 0.2, { type: 'triangle', gain: 0.35 })
      break
    case 'match':
      ;[523, 659, 784].forEach((f, i) =>
        tone(a, f, i * 0.08, 0.28, { type: 'triangle', gain: 0.45 }),
      )
      break
    case 'streak':
    case 'done':
      ;[523, 659, 784, 1047].forEach((f, i) =>
        tone(a, f, i * 0.09, 0.3, { type: 'triangle', gain: 0.45 }),
      )
      ;[784, 1047, 1319].forEach((f) =>
        tone(a, f, 0.4, 0.7, { type: 'sine', gain: 0.25 }),
      )
      break
    case 'halfway':
      tone(a, 784, 0, 0.18, { type: 'triangle', gain: 0.4 })
      tone(a, 1047, 0.16, 0.4, { type: 'triangle', gain: 0.4 })
      break
    case 'tick':
      tone(a, 1200, 0, 0.05, { type: 'square', gain: 0.12 })
      break
    case 'timeup':
      tone(a, 440, 0, 0.45, { type: 'sawtooth', gain: 0.18, slideTo: 200 })
      break
    case 'spin':
      for (let k = 1; k <= WHEEL_CLICKS; k++) {
        const at = WHEEL_SECONDS * (1 - Math.cbrt(1 - k / WHEEL_CLICKS))
        tone(a, 1400, at, 0.03, { type: 'square', gain: 0.08 })
      }
      tone(a, 1047, WHEEL_SECONDS + 0.1, 0.5, { type: 'triangle', gain: 0.4 })
      break
    case 'reaction':
      tone(a, 420, 0, 0.1, { gain: 0.4, slideTo: 900 })
      break
  }
}
