'use client'

import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface HeroIconProps {
  icon: string | null | undefined
  color: string | null | undefined
  size: string
  className?: string
  imageClassName?: string
  width?: number
  height?: number
  loading?: 'eager' | 'lazy'
}

/** Shared hero portrait styling used by the tier list and match scoreboard. */
export function HeroIcon({ icon, color, size, className, imageClassName, width, height, loading = 'lazy' }: HeroIconProps) {
  const style = color ? ({ '--hero': `rgb(${color})` } as CSSProperties) : undefined

  return (
    <span
      style={style}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-sm bg-muted',
        color && 'bg-[color-mix(in_oklch,var(--hero)_35%,var(--muted))]',
        size,
        className,
      )}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          width={width}
          height={height}
          loading={loading}
          decoding="async"
          className={cn('size-full object-contain', imageClassName)}
        />
      ) : null}
    </span>
  )
}
