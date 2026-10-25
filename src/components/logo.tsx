import { Heart } from 'lucide-react'

import { TunisiaFlag } from '@/components/tunisia-flag'

export function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5">
      <span className="bg-love relative grid size-10 place-items-center rounded-2xl shadow-lg shadow-primary/30">
        <Heart className="size-5 fill-white text-white" />
        <TunisiaFlag className="absolute -bottom-1 -end-1.5 h-3.5 w-auto shadow ring-2 ring-background" />
      </span>
      <span className="flex flex-col leading-none">
        <span
          dir="ltr"
          className="font-display text-xl font-bold tracking-tight"
        >
          First Date
        </span>
        <span className="mt-1 text-[11px] font-medium text-gold">
          على الطريقة التونسية
        </span>
      </span>
    </a>
  )
}
