import { useMemo } from 'react'

import { cn } from '@/lib/utils'
import { monthGrid } from '@/lib/calendar-view'
import { groupByDay, itemSelected } from '@/lib/schedule-list'
import { isSameDay } from '@/lib/time'
import type { Occurrence, ScheduleSlot } from '@/types/api'
import { DayItem, DayPopover, type DayItemHandlers } from './day-popover'
import type { GridSelection } from './time-grid'

const MAX_ITEMS = 3

interface MonthViewProps {
  date: Date
  /** Already filtered to the visible calendars. */
  occurrences: Occurrence[]
  slots: ScheduleSlot[]
  selected: GridSelection
  onSelectEvent: (occurrence: Occurrence, anchor: DOMRect) => void
  onSelectSlot: (slot: ScheduleSlot, anchor: DOMRect) => void
  onCreateAllDay: (day: Date, anchor: DOMRect) => void
  onOpenDay: (day: Date) => void
}

const dayKey = (day: Date) => `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`

/** The month view: a grid of day cells with up to three items each, then "+N more". */
export function MonthView({
  date, occurrences, slots, selected, onSelectEvent, onSelectSlot, onCreateAllDay, onOpenDay,
}: MonthViewProps) {
  const weeks = useMemo(() => monthGrid(date), [date])
  const today = new Date()
  const handlers: DayItemHandlers = { onSelectEvent, onSelectSlot }

  const byDay = useMemo(() => {
    const first = weeks[0][0]
    const groups = groupByDay(occurrences, slots, first, weeks.length * 7, new Date(0))
    return new Map(groups.map((group) => [dayKey(group.day), group.items]))
  }, [weeks, occurrences, slots])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-7 border-b border-white/10">
        {weeks[0].map((day) => (
          <p key={day.getDay()} className="py-2 text-center text-xs text-faint">
            {day.toLocaleDateString([], { weekday: 'short' })}
          </p>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7 overflow-y-auto"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(6.5rem, 1fr))` }}
      >
        {weeks.flat().map((day) => {
          const items = byDay.get(dayKey(day)) ?? []
          const visible = items.length > MAX_ITEMS ? items.slice(0, MAX_ITEMS - 1) : items
          const hidden = items.length - visible.length
          const isToday = isSameDay(day, today)
          const outside = day.getMonth() !== date.getMonth()
          const label = day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })

          return (
            <div
              key={dayKey(day)}
              onClick={(event) => onCreateAllDay(day, event.currentTarget.getBoundingClientRect())}
              className="flex min-w-0 flex-col gap-0.5 border-r border-b border-white/10 p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0"
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenDay(day)
                }}
                aria-label={`Open ${label}`}
                className={cn(
                  'mx-auto flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs tnum hover:bg-white/10',
                  outside && 'text-faint/60',
                  isToday && 'bg-primary text-white hover:bg-primary/90',
                )}
              >
                {day.getDate() === 1
                  ? day.toLocaleDateString([], { month: 'short', day: 'numeric' })
                  : day.getDate()}
              </button>
              {visible.map((item) => (
                <DayItem
                  key={item.kind === 'event' ? `e-${item.occurrence.id}` : `s-${item.slot.id}`}
                  item={item}
                  selected={itemSelected(item, selected)}
                  handlers={handlers}
                />
              ))}
              {hidden > 0 && (
                <DayPopover day={day} items={items} count={hidden} selected={selected} handlers={handlers} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
