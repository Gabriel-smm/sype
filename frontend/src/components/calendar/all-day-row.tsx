import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

import { EVENT_INK, hexFor } from '@/lib/colors'
import type { AllDayBar } from '@/lib/drag'
import { cn } from '@/lib/utils'
import type { Occurrence } from '@/types/api'

const VISIBLE_ROWS = 3
const ROW_HEIGHT = 22

interface AllDayRowProps {
  days: Date[]
  bars: AllDayBar[]
  gutter: number
  selectedId: string | null
  /** `anchor` is the bar, which also gets focus back when the popover closes. */
  onSelect: (occurrence: Occurrence, anchor: HTMLElement) => void
}

/** All-day events and anything 24h or longer, as bars spanning the days they cover. */
export function AllDayRow({ days, bars, gutter, selectedId, onSelect }: AllDayRowProps) {
  const [expanded, setExpanded] = useState(false)
  const rows = bars.reduce((count, bar) => Math.max(count, bar.row + 1), 0)
  const collapsible = rows > VISIBLE_ROWS
  const shown = collapsible && !expanded ? bars.filter((bar) => bar.row < VISIBLE_ROWS) : bars
  const hiddenOn = days.map((_, index) => bars.filter((bar) =>
    bar.row >= VISIBLE_ROWS && bar.firstDay <= index && index < bar.firstDay + bar.span).length)
  const lines = collapsible && !expanded ? VISIBLE_ROWS + 1 : rows
  const first = days[0]
  const afterLast = new Date(days[days.length - 1])
  afterLast.setDate(afterLast.getDate() + 1)

  return (
    <div className="flex border-b border-white/10">
      <div className="flex shrink-0 items-end justify-end pr-1 pb-0.5" style={{ width: gutter }}>
        {collapsible && (
          <button
            type="button"
            aria-label={expanded ? 'Show fewer all-day events' : 'Show all all-day events'}
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="rounded-full p-1 text-faint hover:bg-white/10 hover:text-foreground"
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        )}
      </div>
      <div
        className="grid min-w-0 flex-1 gap-y-0.5 py-0.5"
        style={{
          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          gridTemplateRows: lines ? `repeat(${lines}, ${ROW_HEIGHT - 2}px)` : undefined,
          minHeight: 8,
        }}
      >
        {shown.map(({ occurrence, firstDay, span, row }) => {
          const hex = hexFor(occurrence.color_key)
          const clippedStart = new Date(occurrence.start) < first
          const clippedEnd = new Date(occurrence.end) > afterLast
          return (
            <button
              key={occurrence.id}
              type="button"
              data-item-id={occurrence.id}
              aria-pressed={selectedId === occurrence.id}
              onClick={(event) => onSelect(occurrence, event.currentTarget)}
              className={cn(
                'mr-2 ml-px truncate rounded-(--radius-event) px-2 text-left text-xs leading-5 font-semibold',
                clippedStart && 'rounded-l-none',
                clippedEnd && 'rounded-r-none',
                selectedId === occurrence.id && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
              )}
              style={{
                gridColumn: `${firstDay + 1} / span ${span}`,
                gridRow: row + 1,
                background: hex,
                color: EVENT_INK,
              }}
            >
              {occurrence.title || '(No title)'}
            </button>
          )
        })}
        {collapsible && !expanded && hiddenOn.map((count, index) => count > 0 && (
          <button
            key={index}
            type="button"
            aria-label={`${count} more all-day ${count === 1 ? 'event' : 'events'}`}
            onClick={() => setExpanded(true)}
            className="ml-px rounded-(--radius-event) px-2 text-left text-xs leading-5 font-medium text-muted-foreground hover:bg-white/10"
            style={{ gridColumn: index + 1, gridRow: VISIBLE_ROWS + 1 }}
          >
            +{count}
          </button>
        ))}
      </div>
    </div>
  )
}
