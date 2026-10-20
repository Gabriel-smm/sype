import { Circle } from 'lucide-react'
import { useState, type MouseEvent } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EVENT_INK, eventLook, hexFor, slotColor } from '@/lib/colors'
import { isAllDayLike } from '@/lib/drag'
import { itemSelected, type ScheduleItem } from '@/lib/schedule-list'
import { formatShortTime, formatTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Occurrence, ScheduleSlot } from '@/types/api'
import type { GridSelection } from './time-grid'

export interface DayItemHandlers {
  /** `anchor` is the clicked item, which also gets focus back when the popover closes. */
  onSelectEvent: (occurrence: Occurrence, anchor: HTMLElement) => void
  onSelectSlot: (slot: ScheduleSlot, anchor: DOMRect) => void
}

/** One event or task block in a month cell or the day popover: a bar, or a dot, time and title. */
export function DayItem({
  item, selected, handlers, onActivate,
}: {
  item: ScheduleItem
  selected: boolean
  handlers: DayItemHandlers
  /** Runs after the click, e.g. to close the popover this item sits in. */
  onActivate?: () => void
}) {
  const click = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (item.kind === 'event') handlers.onSelectEvent(item.occurrence, event.currentTarget)
    else handlers.onSelectSlot(item.slot, event.currentTarget.getBoundingClientRect())
    onActivate?.()
  }
  const base = cn(
    'flex h-5 w-full min-w-0 focus-visible:outline-offset-[-2px] items-center gap-1 rounded-(--radius-event) px-1.5 text-left text-xs leading-5',
    selected && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
  )

  if (item.kind === 'task') {
    const { slot } = item
    const hex = hexFor(slotColor(slot))
    return (
      <button type="button" onClick={click} className={cn(base, 'text-white hover:bg-white/10')}
        aria-label={`${slot.title}, ${formatTimeRange(new Date(slot.start_time), new Date(slot.end_time))}`}>
        <Circle aria-hidden className="size-2.5 shrink-0" style={{ color: hex }} />
        <span className="shrink-0 tnum text-faint">{formatShortTime(new Date(slot.start_time))}</span>
        <span className="min-w-0 truncate">{slot.title}</span>
      </button>
    )
  }

  const { occurrence } = item
  const hex = hexFor(occurrence.color_key)
  const title = occurrence.title || '(No title)'
  const start = new Date(occurrence.start)

  if (isAllDayLike(occurrence)) {
    const free = eventLook(occurrence) === 'free'
    return (
      <button type="button" onClick={click} data-item-id={occurrence.id} aria-label={`${title}, all day${free ? ', free' : ''}`}
        className={cn(base, 'font-semibold')}
        style={free
          ? { background: `color-mix(in oklab, ${hex} 10%, transparent)`, border: `1px solid ${hex}`, color: hex }
          : { background: hex, color: EVENT_INK }}>
        <span className="min-w-0 truncate">{title}</span>
      </button>
    )
  }

  return (
    <button type="button" onClick={click} data-item-id={occurrence.id} className={cn(base, 'text-white hover:bg-white/10')}
      aria-label={`${title}, ${formatTimeRange(start, new Date(occurrence.end))}`}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: hex }} />
      <span className="shrink-0 tnum text-faint">{formatShortTime(start)}</span>
      <span className="min-w-0 truncate">{title}</span>
    </button>
  )
}

/** The "+N more" button of a month cell and the popover listing everything on that day. */
export function DayPopover({
  day, items, count, selected, handlers,
}: {
  day: Date
  items: ScheduleItem[]
  count: number
  selected: GridSelection
  handlers: DayItemHandlers
}) {
  const [open, setOpen] = useState(false)
  const heading = day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`${count} more on ${heading}`}
          className="h-5 w-full focus-visible:outline-offset-[-2px] rounded-(--radius-event) px-1.5 text-left text-xs leading-5 text-faint hover:bg-white/10 hover:text-foreground"
        >
          {count} more
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" onClick={(event) => event.stopPropagation()}>
        <p className="px-1.5 pb-2 text-sm text-faint">{heading}</p>
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <DayItem
              key={item.kind === 'event' ? `e-${item.occurrence.id}` : `s-${item.slot.id}`}
              item={item}
              selected={itemSelected(item, selected)}
              handlers={handlers}
              onActivate={() => setOpen(false)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

