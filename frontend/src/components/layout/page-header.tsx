import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Small line above the title, e.g. today's date. */
  kicker?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, kicker, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end gap-x-6 gap-y-4', className)}>
      <div className="min-w-0 flex-1">
        {kicker && <p className="mb-2 text-sm text-muted-foreground">{kicker}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">{title}</h1>
        {description && (
          <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** A titled group inside a page. */
export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="text-[15px] font-medium text-foreground/80">{children}</h2>
      {aside && <div className="ml-auto text-sm text-faint">{aside}</div>}
    </div>
  )
}
