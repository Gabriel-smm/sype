import { hexFor } from '@/lib/colors'
import type { Occurrence } from '@/types/api'

/**
 * Sleep, meals and other routines: a full-width hatched band behind the events.
 * Clicks pass through it, so a draft can still be created on top.
 */
export function RoutineBand({
  occurrence, top, height,
}: { occurrence: Occurrence; top: number; height: number }) {
  const hex = hexFor(occurrence.color_key)
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-[1] overflow-hidden px-1.5 pt-0.5"
      style={{
        top,
        height,
        backgroundImage: `repeating-linear-gradient(-45deg, color-mix(in oklab, ${hex} 20%, transparent) 0 1px, transparent 1px 7px)`,
      }}
    >
      <span
        className={height >= 16 ? 'block truncate text-[11px] leading-3' : 'sr-only'}
        style={{ color: hex }}
      >
        {occurrence.title}
      </span>
    </div>
  )
}
