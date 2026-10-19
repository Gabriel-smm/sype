import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react'

import { EVENT_INK, eventLook, hexFor } from '@/lib/colors'
import { formatShortTime, formatTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Occurrence } from '@/types/api'

/** Where a chip sits in its day column, and how much of it is on this day. */
export interface ChipPlacement {
  style: CSSProperties
  /** Visible minutes in this column (an overnight event is split per day). */
  minutes: number
  /** This part holds the real end, so it carries the resize handle. */
  last: boolean
}

type PointerHandler = (event: PointerEvent<HTMLElement>) => void

export interface ChipInteraction {
  selected: boolean
  /** The original while its lifted copy is dragged. */
  faded?: boolean
  /** The dragged copy: raised, showing the live time range. */
  lifted?: boolean
  onSelect: (anchor: HTMLElement) => void
  onPointerDown?: PointerHandler
  onResizePointerDown?: (event: PointerEvent<HTMLElement>, chip: HTMLElement) => void
}

function chipKeyDown(onSelect: (anchor: HTMLElement) => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(event.currentTarget)
    }
  }
}

/** The shared frame of event chips and task blocks: position, focus, drag and the 6px resize edge. */
export function ChipFrame({
  placement, interaction, label, className, style, children,
}: {
  placement: ChipPlacement
  interaction: ChipInteraction
  label: string
  className?: string
  style: CSSProperties
  children: ReactNode
}) {
  const { selected, faded, lifted, onSelect, onPointerDown, onResizePointerDown } = interaction
  return (
    <div
      role="button"
      tabIndex={lifted ? -1 : 0}
      aria-label={label}
      aria-pressed={selected}
      data-chip
      onPointerDown={onPointerDown}
      onKeyDown={chipKeyDown(onSelect)}
      className={cn(
        'absolute overflow-hidden rounded-(--radius-event) px-1.5 text-xs leading-4 select-none',
        onPointerDown && 'pointer-fine:touch-none',
        lifted ? 'pointer-events-none z-30 cursor-grabbing shadow-2xl' : 'z-20',
        faded && 'opacity-50',
        selected && !lifted && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
        className,
      )}
      style={{ ...placement.style, ...style }}
    >
      {children}
      {placement.last && onResizePointerDown && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize pointer-fine:touch-none"
          onPointerDown={(event) => {
            const chip = event.currentTarget.closest<HTMLElement>('[data-chip]')
            if (chip) onResizePointerDown(event, chip)
          }}
        />
      )}
    </div>
  )
}

/**
 * Chip body copy, Google-style: under 30 minutes one line "Title, 9:00";
 * otherwise the title, plus the time range from 45 minutes. A chip being
 * dragged (`live`) always shows its full range.
 */
export function ChipText({
  title, start, end, minutes, leading, live,
}: { title: string; start: Date; end: Date; minutes: number; leading?: ReactNode; live?: boolean }) {
  if (minutes < 30 || (live && minutes < 45)) {
    return (
      <p className="flex items-center gap-1 text-[11px] leading-3 whitespace-nowrap">
        {leading}
        <span className="min-w-0 truncate font-semibold">{title},</span>
        <span className="shrink-0 tnum">{live ? formatTimeRange(start, end) : formatShortTime(start)}</span>
      </p>
    )
  }
  return (
    <div className="pt-0.5">
      <p className="flex items-center gap-1 font-semibold">
        {leading}
        <span className={cn('break-words', live ? 'truncate' : 'line-clamp-2')}>{title}</span>
      </p>
      {(live || minutes >= 45) && <p className="truncate tnum opacity-80">{formatTimeRange(start, end)}</p>}
    </div>
  )
}

interface EventChipProps {
  occurrence: Occurrence
  placement: ChipPlacement
  interaction: ChipInteraction
  /** The live range while dragging; the occurrence's own times otherwise. */
  range?: { start: Date; end: Date }
}

/** A calendar event: solid pastel when Busy, outlined pastel when Free. */
export function EventChip({ occurrence, placement, interaction, range }: EventChipProps) {
  const hex = hexFor(occurrence.color_key)
  const free = eventLook(occurrence) === 'free'
  const start = range?.start ?? new Date(occurrence.start)
  const end = range?.end ?? new Date(occurrence.end)

  return (
    <ChipFrame
      placement={placement}
      interaction={interaction}
      label={`${occurrence.title || '(No title)'}, ${formatTimeRange(start, end)}${free ? ', free' : ''}`}
      style={free
        ? { background: `color-mix(in oklab, ${hex} 10%, transparent)`, border: `1px solid ${hex}`, color: hex }
        : { background: hex, color: EVENT_INK }}
    >
      <ChipText
        title={occurrence.title || '(No title)'}
        start={start}
        end={end}
        minutes={placement.minutes}
        live={interaction.lifted}
      />
    </ChipFrame>
  )
}
