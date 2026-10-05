import type { Tier } from '@/lib/tiers'
import { cn } from '@/lib/utils'

const TIER_STYLE: Record<Tier, string> = {
  S: 'bg-tier-s text-primary-foreground',
  A: 'bg-tier-a text-primary-foreground',
  B: 'bg-tier-b text-primary-foreground',
  C: 'bg-tier-c text-primary-foreground',
  D: 'bg-tier-d text-primary-foreground',
  F: 'bg-tier-f text-primary-foreground',
}

/** Letter plus a distinct shape, so tiers never rely on color alone. */
function TierShape({ tier }: { tier: Tier }) {
  const common = { width: 8, height: 8, viewBox: '0 0 10 10', 'aria-hidden': true, className: 'fill-current' } as const
  switch (tier) {
    case 'S':
      return <svg {...common}><path d="M5 0 10 5 5 10 0 5z" /></svg>
    case 'A':
      return <svg {...common}><path d="M5 0 10 10H0z" /></svg>
    case 'B':
      return <svg {...common}><path d="M1 1h8v8H1z" /></svg>
    case 'C':
      return <svg {...common}><circle cx="5" cy="5" r="4.5" /></svg>
    case 'D':
      return <svg {...common}><path d="M0 0h10L5 10z" /></svg>
    case 'F':
      return (
        <svg {...common} className="fill-none stroke-current" strokeWidth={2.5}>
          <path d="M1 1 9 9M9 1 1 9" />
        </svg>
      )
  }
}

export function TierBadge({ tier, label, className }: { tier: Tier; label: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'inline-flex h-9 w-12 items-center justify-center gap-1 font-display text-xl font-bold leading-none',
        TIER_STYLE[tier],
        className,
      )}
    >
      <TierShape tier={tier} />
      {tier}
    </span>
  )
}
