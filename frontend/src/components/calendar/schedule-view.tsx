import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { groupByDay } from '@/lib/schedule-list'
import { cn } from '@/lib/utils'
import type { Occurrence, ScheduleSlot } from '@/types/api'
import { hexFor, slotColor } from '@/lib/colors'
import { isAllDayLike } from '@/lib/drag'
import { formatTimeRange, isSameDay } from '@/lib/time'
import { Circle } from 'lucide-react'

interface ScheduleViewProps {
  start: Date
  days: number
  /** Already filtered to the visible calendars. */
  occurrences: Occurrence[]
  slots: ScheduleSlot[]
  onSelectEvent: (occurrence: Occurrence, anchor: DOMRect) => void
  onSelectSlot: (slot: ScheduleSlot, anchor: DOMRect) => void
  onCreate: (anchor: DOMRect) => void
}

/** The schedule view: a list grouped by day, each row a dot, its time range and the title. */
export function ScheduleView({
  start, days, occurrences, slots, onSelectEvent, onSelectSlot, onCreate,
}: ScheduleViewProps) {
  const today = new Date()
  const groups = useMemo(
    () => groupByDay(occurrences, slots, start, days, new Date()),
    [occurrences, slots, start, days],
  )

  if (groups.every((group) => group.items.length === 0)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg">Nothing planned</p>
        <Button variant="secondary" onClick={(event) => onCreate(event.currentTarget.getBoundingClientRect())}>
          Create
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {groups.map(({ day, items }) => {
        const isToday = isSameDay(day, today)
        return (
          <section key={day.getTime()} className="flex gap-4 border-b border-white/10 px-3 py-3 sm:px-6">
            <div className="flex w-20 shrink-0 items-start gap-2 sm:w-28">
              <span className={cn(
                'flex size-11 items-center justify-center rounded-full text-2xl tnum',
                isToday && 'bg-primary text-white',
              )}>
                {day.getDate()}
              </span>
              <span className="pt-1 text-xs text-faint">
                {day.toLocaleDateString([], { month: 'short' })}
                <br />
                {day.toLocaleDateString([], { weekday: 'short' })}
              </span>
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
              {items.length === 0 && <li className="py-2 text-sm text-faint">Nothing planned</li>}
              {items.map((item) => {
                const isEvent = item.kind === 'event'
                const from = new Date(isEvent ? item.occurrence.start : item.slot.start_time)
                const to = new Date(isEvent ? item.occurrence.end : item.slot.end_time)
                const hex = hexFor(isEvent ? item.occurrence.color_key : slotColor(item.slot))
                const title = isEvent ? item.occurrence.title || '(No title)' : item.slot.title
                const allDay = isEvent && isAllDayLike(item.occurrence)
                const range = allDay ? 'All day' : formatTimeRange(from, to)
                return (
                  <li key={isEvent ? `e-${item.occurrence.id}` : `s-${item.slot.id}`}>
                    <button
                      type="button"
                      aria-label={`${title}, ${range}`}
                      onClick={(event) => {
                        const anchor = event.currentTarget.getBoundingClientRect()
                        if (isEvent) onSelectEvent(item.occurrence, anchor)
                        else onSelectSlot(item.slot, anchor)
                      }}
                      className="flex min-h-9 w-full items-center gap-3 rounded-md px-2 py-1 text-left text-sm hover:bg-white/10 focus-visible:outline-offset-[-2px]"
                    >
                      {isEvent
                        ? <span aria-hidden className="size-3 shrink-0 rounded-full"
                          style={item.occurrence.busy
                            ? { background: hex }
                            : { border: `2px solid ${hex}`, background: 'transparent' }} />
                        : <Circle aria-hidden className="size-3 shrink-0" style={{ color: hex }} />}
                      <span className="w-28 shrink-0 tnum text-faint">{range}</span>
                      <span className="min-w-0 truncate">{title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
