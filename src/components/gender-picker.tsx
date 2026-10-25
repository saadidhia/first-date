import type { Gender } from '@/lib/session'
import { cn } from '@/lib/utils'

const OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: 'male', label: 'راجل', emoji: '👨' },
  { value: 'female', label: 'مرا', emoji: '👩' },
]

/** Required before entering a room: the last questions are worded per gender. */
export function GenderPicker({
  value,
  onChange,
}: {
  value: Gender | null
  onChange: (g: Gender) => void
}) {
  return (
    <div role="radiogroup" aria-label="الجنس" className="grid grid-cols-2 gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-12 items-center justify-center gap-2 rounded-xl border text-base font-semibold transition',
            value === o.value
              ? 'border-primary bg-primary/15 text-foreground ring-1 ring-primary'
              : 'border-border bg-background/60 text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="text-xl">{o.emoji}</span> {o.label}
        </button>
      ))}
    </div>
  )
}
