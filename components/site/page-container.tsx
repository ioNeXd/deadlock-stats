import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: ReactNode
  className?: string
  id?: string
}

/**
 * Standardized Page Container.
 * Enforces unified width and fluid responsiveness across all site pages so transitioning
 * between tabs (Player, Tier List, Methodology, Status, etc.) does not cause layout shifts.
 */
export function PageContainer({ children, className, id = 'main' }: PageContainerProps) {
  return (
    <main
      id={id}
      className={cn(
        'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:px-8 md:py-12 flex flex-col gap-6 lg:gap-8',
        className
      )}
    >
      {children}
    </main>
  )
}
