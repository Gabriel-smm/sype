import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

interface GlassCardProps extends ComponentProps<'section'> {
  /** Lift and brighten on hover, as Sype's feature cards do. */
  hoverEffect?: boolean
}

/** Sype's frosted card, with its hover lift and sheen. */
function GlassCard({ className, hoverEffect = false, children, ...props }: GlassCardProps) {
  return (
    <section
      data-slot="glass-card"
      className={cn(
        'glass group relative overflow-hidden rounded-3xl p-8',
        hoverEffect && 'glass-hover hover:-translate-y-1',
        className,
      )}
      {...props}
    >
      {hoverEffect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0
                     transition-opacity duration-500 group-hover:opacity-100"
        />
      )}
      {children}
    </section>
  )
}

export { GlassCard }
