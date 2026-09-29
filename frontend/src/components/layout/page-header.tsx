import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: 'easeOut' as const },
})

/** Sype's "Free Beta Available" pill: glass, a pinging blue dot, small caps. */
export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
      </span>
      <span className="text-xs font-medium tracking-wider text-white/80 uppercase">{children}</span>
    </span>
  )
}

interface PageHeaderProps {
  title: ReactNode
  /** Second line of the title, in Sype's white-to-grey gradient. */
  accent?: ReactNode
  description?: ReactNode
  /** Shown as the status badge above the title. */
  badge?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Sype's hero, sized for an app page: badge, then title, then description. */
export function PageHeader({ title, accent, description, badge, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end gap-x-6 gap-y-5', className)}>
      <div className="min-w-0 flex-1">
        {badge && <motion.div {...rise(0)} className="mb-6"><StatusBadge>{badge}</StatusBadge></motion.div>}
        <motion.h1 {...rise(0.2)} className="text-5xl font-bold tracking-tight text-balance text-white md:text-7xl">
          {title}
          {accent && <><br /><span className="text-gradient">{accent}</span></>}
        </motion.h1>
        {description && (
          <motion.p {...rise(0.4)} className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            {description}
          </motion.p>
        )}
      </div>
      {actions && <motion.div {...rise(0.4)} className="flex flex-wrap items-center gap-2">{actions}</motion.div>}
    </header>
  )
}

/** Sype's section title: bold, with the blue bar that draws itself underneath. */
export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-8', className)}>
      <div className="flex items-baseline gap-4">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl font-bold tracking-tight md:text-4xl"
        >
          {children}
        </motion.h2>
        {aside != null && <span className="ml-auto text-sm text-white/40 tnum">{aside}</span>}
      </div>
      <motion.div
        initial={{ opacity: 0, width: 0 }}
        whileInView={{ opacity: 1, width: '100px' }}
        viewport={{ once: true }}
        className="mt-4 h-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
      />
    </div>
  )
}

/** A smaller heading for groups inside a card. */
export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{children}</h2>
      {aside != null && <div className="ml-auto text-sm text-white/40 tnum">{aside}</div>}
    </div>
  )
}

/** Sype's icon tile: a soft square holding a blue lucide icon. */
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <div className="w-fit rounded-2xl bg-white/5 p-4 text-blue-400 transition-colors group-hover:bg-white/10 [&_svg]:size-8">
      {children}
    </div>
  )
}
