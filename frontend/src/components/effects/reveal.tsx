import { motion } from 'motion/react'
import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  /** Position in a staggered group; each step waits another 0.1s, as on Sype. */
  index?: number
  /** Extra delay in seconds, for page-load sequences. */
  delay?: number
  className?: string
}

/** Sype's entrance: fade up 20px the first time it scrolls into view. */
export function Reveal({ children, index = 0, delay = 0, className }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: delay + index * 0.1, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
