import { Bell, BellOff } from 'lucide-react'

import { setSfxOn, useSfxOn } from '@/lib/sfx'
import { cn } from '@/lib/utils'

/** A row for the music popover (date rooms): game sounds on / off. */
export function SfxToggleRow() {
  const on = useSfxOn()
  return (
    <button
      type="button"
      onClick={() => setSfxOn(!on)}
      className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs"
    >
      <span>🔔 أصوات اللعبة</span>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 font-semibold',
          on
            ? 'bg-primary/20 text-primary'
            : 'bg-background text-muted-foreground',
        )}
      >
        {on ? 'مشعولين' : 'مسكّرين'}
      </span>
    </button>
  )
}

/** A header button for rooms without music (friends): game sounds on / off. */
export function SfxButton() {
  const on = useSfxOn()
  const Icon = on ? Bell : BellOff
  return (
    <button
      type="button"
      onClick={() => setSfxOn(!on)}
      className="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted"
      aria-label={on ? 'سكّر أصوات اللعبة' : 'حلّ أصوات اللعبة'}
      title={on ? 'سكّر أصوات اللعبة' : 'حلّ أصوات اللعبة'}
    >
      <Icon
        className={cn(
          'size-4',
          on ? 'text-sidi-blue' : 'text-muted-foreground',
        )}
      />
    </button>
  )
}
