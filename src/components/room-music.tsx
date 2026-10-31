import { useEffect, useRef, useState } from 'react'
import { Music, VolumeX } from 'lucide-react'

import { cn } from '@/lib/utils'

// Drop a royalty-free track here (looping). Starts soft on purpose.
const SRC = '/romantic.mp3'
const VOLUME = 0.12

/**
 * Soft looping romantic music for a First Date room. Plays by default at a low
 * volume, fades down and pauses while someone is talking in the call (`ducked`),
 * and has an on/off button. If the file is missing it hides itself.
 */
export function RoomMusic({ ducked }: { ducked: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const fadeRef = useRef<number | null>(null)
  const wantRef = useRef(false)
  const [on, setOn] = useState(true)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // What we want right now: on, loaded, and nobody is talking.
  useEffect(() => {
    wantRef.current = on && ready && !ducked
  }, [on, ready, ducked])

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

  // Play/pause + fade whenever the desired state changes.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !ready) return
    if (fadeRef.current) window.clearInterval(fadeRef.current)

    if (on && !ducked) {
      audio.play().catch(() => {}) // the tap fallback above covers a block
      fadeRef.current = window.setInterval(() => {
        audio.volume = Math.min(VOLUME, audio.volume + 0.02)
        if (audio.volume >= VOLUME - 0.001) {
          audio.volume = VOLUME
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
        <button
          type="button"
          onClick={() => setOn((v) => !v)}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          aria-label={on ? 'سكّر الموسيقى' : 'حلّ الموسيقى'}
          title={on ? 'سكّر الموسيقى' : 'حلّ الموسيقى'}
        >
          {on ? (
            <Music
              className={cn(
                'size-4 transition-colors',
                ducked ? 'text-muted-foreground' : 'text-primary',
              )}
            />
          ) : (
            <VolumeX className="size-4" />
          )}
        </button>
      )}
    </>
  )
}
