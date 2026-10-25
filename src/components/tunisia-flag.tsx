import { cn } from '@/lib/utils'

/** Tunisian flag as an inline SVG so it stays crisp at any size. */
export function TunisiaFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      role="img"
      aria-label="علم تونس"
      className={cn('rounded-[3px]', className)}
    >
      <rect width="30" height="20" fill="#E70013" />
      <circle cx="15" cy="10" r="5" fill="#fff" />
      <circle cx="15" cy="10" r="3.75" fill="#E70013" />
      <circle cx="15.95" cy="10" r="3" fill="#fff" />
      <polygon
        fill="#E70013"
        points="13.95,10.00 15.47,9.47 15.50,7.86 16.48,9.14 18.02,8.68 17.10,10.00 18.02,11.32 16.48,10.86 15.50,12.14 15.47,10.53"
      />
    </svg>
  )
}
