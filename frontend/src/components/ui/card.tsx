import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Sype's app panel: zinc glass, used for the calendar, tasks, chat and every page. */
function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'appglass flex flex-col gap-6 rounded-xl border border-sidebar-border bg-sidebar py-6 text-sidebar-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

/** Title and one-line subtitle at the top of a card, as on Sype's Tasks and Co-Pilot panels. */
function CardHeader({ title, description, actions, className }: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-shrink-0 items-start justify-between gap-3 px-4', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-semibold text-sidebar-foreground">{title}</h2>
        {description && <p className="text-xs text-sidebar-foreground/60">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

export { Card, CardHeader }
