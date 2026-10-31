import { useEffect, useRef, useState } from 'react'
import { Music, Volume1, Volume2, VolumeX } from 'lucide-react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Drop a royalty-free track here (looping). Starts soft on purpose.
const SRC = '/romantic.mp3'
const DEFAULT_VOLUME = 0.1
const ON_KEY = 'firstdate:music:on'
const VOL_KEY = 'firstdate:music:vol'

function readStored<T>(key: string, fallback: T, parse: (s: string) => T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : parse(raw)
  } catch {
    return fallback
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private mode / blocked storage: ignore, the control still works this session
  }
}

/**
 * Soft looping romantic music for a First Date room. Plays by default at a low
 * volume, fades out and pauses while someone is talking in the call (`ducked`),
 * and offers an on/off + volume slider (remembered per browser). Hides itself if
 * the file is missing.
 */
export function RoomMusic({ ducked }: { ducked: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const fadeRef = useRef<number | null>(null)
  const volRef = useRef(DEFAULT_VOLUME)
  const wantRef = useRef(false)
  const [on, setOn] = useState(() =>
    readStored(ON_KEY, true, (s) => s !== '0'),
  )
  const [vol, setVol] = useState(() =>
    readStored(VOL_KEY, DEFAULT_VOLUME, (s) => {
      const n = Number(s)
      return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_VOLUME
    }),
  )
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // What we want right now: on, loaded, and nobody is talking.
  useEffect(() => {
    wantRef.current = on && ready && !ducked
    volRef.current = vol
  }, [on, ready, ducked, vol])

  // Start at silence so the first fade-in is smooth, and retry playback on the
  // first tap (browsers block autoplay with sound until a user gesture).
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = 0
    const unlock = () => {
      if (wantRef.current) audio.play().catch(() => {})
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // Play/pause + fade whenever on / ready / ducked changes.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !ready) return
    if (fadeRef.current) window.clearInterval(fadeRef.current)

    if (on && !ducked) {
      audio.play().catch(() => {}) // the tap fallback above covers a block
      fadeRef.current = window.setInterval(() => {
        const target = volRef.current
        audio.volume = Math.min(target, audio.volume + 0.02)
        if (audio.volume >= target - 0.001) {
          audio.volume = target
          if (fadeRef.current) window.clearInterval(fadeRef.current)
        }
      }, 60)
    } else {
      fadeRef.current = window.setInterval(() => {
        audio.volume = Math.max(0, audio.volume - 0.03)
        if (audio.volume <= 0.001) {
          audio.volume = 0
          audio.pause()
          if (fadeRef.current) window.clearInterval(fadeRef.current)
        }
      }, 60)
    }

    return () => {
      if (fadeRef.current) window.clearInterval(fadeRef.current)
    }
  }, [on, ready, ducked])

  // Live-apply slider changes while the music is actually audible.
  useEffect(() => {
    const audio = audioRef.current
    if (audio && ready && on && !ducked) audio.volume = vol
  }, [vol, ready, on, ducked])

  const toggle = () => {
    setOn((v) => {
      store(ON_KEY, v ? '0' : '1')
      return !v
    })
  }

  const changeVol = (next: number) => {
    setVol(next)
    store(VOL_KEY, String(next))
  }

  const VolIcon = !on ? VolumeX : vol < 0.01 ? VolumeX : vol < 0.4 ? Volume1 : Volume2

  return (
    <>
      <audio
        ref={audioRef}
        src={SRC}
        loop
        preload="auto"
        onCanPlay={() => setReady(true)}
        onError={() => setFailed(true)}
      />
      {!failed && (
        <Popover>
          <PopoverTrigger
            className={cn(
              'relative grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted',
              on && !ducked && 'bg-primary/10',
            )}
            aria-label="الموسيقى"
            title="الموسيقى"
          >
            <Music
              className={cn(
                'size-4 transition-colors',
                on && !ducked
                  ? 'animate-pulse text-primary'
                  : 'text-muted-foreground',
              )}
            />
            {/* A sign that this button is the music, and it's playing now */}
            {on && !ducked && (
              <span className="absolute -end-0.5 -top-0.5 flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="flex items-center gap-2" dir="ltr">
              <button
                type="button"
                onClick={toggle}
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full transition-colors',
                  on
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
                aria-label={on ? 'سكّر الموسيقى' : 'حلّ الموسيقى'}
                title={on ? 'سكّر الموسيقى' : 'حلّ الموسيقى'}
              >
                <VolIcon className="size-4" />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(vol * 100)}
                onChange={(e) => changeVol(Number(e.target.value) / 100)}
                disabled={!on}
                className="h-1.5 flex-1 cursor-pointer accent-primary disabled:opacity-40"
                aria-label="صوت الموسيقى"
              />
              <span className="w-7 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                {Math.round(vol * 100)}
              </span>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              🎵 موسيقى رومانسية
            </p>
          </PopoverContent>
        </Popover>
      )}
    </>
  )
}
