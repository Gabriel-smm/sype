import { Check } from 'lucide-react'
import { motion } from 'motion/react'

/** A round check box. The check draws in when a task is marked done. */
export function Tick({ done = false, color = 'rgb(255 255 255 / 0.6)', size = 20 }: {
  done?: boolean
  color?: string
  size?: number
}) {
  return (
    <span
      className="grid place-items-center rounded-full border transition-colors"
      style={{
        width: size,
        height: size,
        borderColor: done ? color : 'rgb(255 255 255 / 0.25)',
        background: done ? `color-mix(in oklab, ${color} 22%, transparent)` : 'transparent',
      }}
    >
      {done && (
        <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                     transition={{ type: 'spring', stiffness: 500, damping: 26 }}>
          <Check style={{ color, width: size * 0.6, height: size * 0.6 }} strokeWidth={3} />
        </motion.span>
      )}
    </span>
  )
}
