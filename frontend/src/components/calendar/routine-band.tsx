import { hexFor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { Occurrence } from '@/types/api'

/**
 * Sleep, meals and other routines: a full-width hatched band behind the events.
 * The band lets clicks through, so a draft can still be created on top; only its
 * label is a button, which opens the event's popover (never a drag).
 */
export function RoutineBand({
  occurrence, top, height, selected, onSelect,
}: {
  occurrence: Occurrence
  top: number
  height: number
  selected: boolean
  onSelect: (occurrence: Occurrence, anchor: HTMLElement) => void
}) {
  const hex = hexFor(occurrence.color_key)
  const title = occurrence.title || '(No title)'
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-[1] px-1.5 pt-0.5"
      style={{
        top,
        height,
        backgroundImage: `repeating-linear-gradient(-45deg, color-mix(in oklab, ${hex} 20%, transparent) 0 1px, transparent 1px 7px)`,
      }}
    >
      <button
        type="button"
        data-item-id={occurrence.id}
        aria-pressed={selected}
        // Stop the column from starting a drag-create under the label.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => onSelect(occurrence, event.currentTarget)}
        className={cn(
          'pointer-events-auto block max-w-full truncate rounded-sm px-0.5 text-left text-[11px] leading-3 hover:underline',
          height < 16 && 'sr-only focus-visible:not-sr-only',
          selected && 'ring-2 ring-ring',
        )}
        style={{ color: hex }}
      >
        {title}
      </button>
    </div>
  )
}
