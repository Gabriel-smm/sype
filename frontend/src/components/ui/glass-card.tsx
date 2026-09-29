import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** Sype's frosted panel. Page-level surfaces are rounded-3xl; rows inside them are smaller. */
function GlassCard({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      data-slot="glass-card"
      className={cn('glass relative overflow-hidden rounded-3xl p-6', className)}
      {...props}
    />
  )
}

export { GlassCard }
