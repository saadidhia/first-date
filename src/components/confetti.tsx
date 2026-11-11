import { useEffect, useState } from 'react'

const COLORS = ['#e0324a', '#e9b949', '#2f7fd1', '#ffffff', '#34d399']
const PIECES = 48

type Piece = {
  left: number
  delay: number
  duration: number
  color: string
  size: number
  drift: number
  round: boolean
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.35,
    duration: 1.6 + Math.random() * 1.2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 6,
    drift: (Math.random() - 0.5) * 120,
    round: Math.random() < 0.3,
  }))
}

/**
 * A burst of confetti over its (relative) parent. Render it with a new `key` to fire it again;
 * the pieces clear themselves after about 3 seconds.
 */
export function Confetti({ burst }: { burst: number }) {
  const [pieces, setPieces] = useState(makePieces)

  useEffect(() => {
    const id = window.setTimeout(() => setPieces([]), 3200)
    return () => window.clearTimeout(id)
  }, [])

  if (!pieces.length) return null
  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      aria-hidden
    >
      {pieces.map((p, i) => (
        <span
          key={`${burst}-${i}`}
          className="confetti-piece absolute -top-4"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              background: p.color,
              borderRadius: p.round ? '9999px' : '2px',
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
