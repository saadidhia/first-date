import { cn } from '@/lib/utils'

export type RoomMode = 'date' | 'friends'

const OPTIONS: { value: RoomMode; label: string; hint: string; emoji: string }[] = [
  { value: 'date', label: 'First Date', hint: 'تعارف بين راجل ومرا، وفي الآخر الزواج', emoji: '💘' },
  { value: 'friends', label: 'صحاب', hint: 'من 2 لـ 7 صحاب: قدّاش تعرفو بعضكم بالحق؟', emoji: '🤝' },
]

/** Chosen by the host before creating a room: it decides which question bank is used. */
export function ModePicker({
  value,
  onChange,
}: {
  value: RoomMode
  onChange: (m: RoomMode) => void
}) {
  return (
    <div role="radiogroup" aria-label="نوع اللعبة" className="grid grid-cols-2 gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-2xl border p-3.5 text-start transition',
            value === o.value
              ? o.value === 'date'
                ? 'border-primary bg-primary/15 ring-1 ring-primary'
                : 'border-sidi-blue bg-sidi-blue/15 ring-1 ring-sidi-blue'
              : 'border-border bg-background/60 hover:border-muted-foreground',
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-2xl">{o.emoji}</span>
            <span dir={o.value === 'date' ? 'ltr' : undefined}>{o.label}</span>
          </div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{o.hint}</div>
        </button>
      ))}
    </div>
  )
}
