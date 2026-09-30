import { Repeat } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

import { useNow } from '@/hooks/use-now'
import { ALARM, typeColor, typeLabel } from '@/lib/task-meta'
import {
  MINUTES_IN_DAY,
  daysOfWeek,
  expandRecurring,
  formatClock,
  isSameDay,
  layoutColumns,
  minutesSinceMidnight,
  weekStartOf,
  type Placed,
} from '@/lib/time'
import { cn } from '@/lib/utils'
import type { FixedBlock, ProductiveWindow, ScheduleSlot } from '@/types/api'

const HOUR_HEIGHT = 48
const DAY_HEIGHT = HOUR_HEIGHT * 24
const SNAP_MINUTES = 15
const DRAG_THRESHOLD = 4
const GUTTER = 64

// Sype prints event times as zero-padded 24-hour clocks.
const hhmm = (value: string) => new Date(value).toTimeString().slice(0, 5)

const top = (minute: number) => (minute / MINUTES_IN_DAY) * DAY_HEIGHT
const height = (minutes: number) => Math.max((minutes / MINUTES_IN_DAY) * DAY_HEIGHT, 24)

type Entry = Placed<{ slot: ScheduleSlot; startMinute: number; endMinute: number }>

interface Drag {
  slot: ScheduleSlot
  originX: number
  originY: number
  columnWidth: number
  offsetDays: number
  offsetMinutes: number
  moved: boolean
}

interface WeekGridProps {
  slots: ScheduleSlot[]
  fixedBlocks: FixedBlock[]
  productiveHours: ProductiveWindow[]
  date: Date
  selectedId?: number
  onSelectSlot: (slot: ScheduleSlot) => void
  onMoveSlot: (slot: ScheduleSlot, start: Date, end: Date) => void
}

export function WeekGrid({
  slots, fixedBlocks, productiveHours, date, selectedId, onSelectSlot, onMoveSlot,
}: WeekGridProps) {
  const now = useNow()
  const scroller = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)

  const weekStart = weekStartOf(date)
  const days = daysOfWeek(date)

  // Open on the working day rather than at midnight.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 6 * HOUR_HEIGHT
  }, [])

  const busy = expandRecurring(fixedBlocks, weekStart, 'fixed')
  const focus = expandRecurring(productiveHours, weekStart, 'productive')

  // Work blocks, bucketed by the day column they belong to.
  const byDay = days.map((): Omit<Entry, 'column' | 'columns'>[] => [])
  slots.forEach((slot) => {
    const start = new Date(slot.start_time)
    const end = new Date(slot.end_time)
    const dayOffset = days.findIndex((day) => isSameDay(day, start))
    if (dayOffset === -1) return
    byDay[dayOffset].push({
      slot,
      startMinute: minutesSinceMidnight(start),
      endMinute: Math.min(
        minutesSinceMidnight(start) + Math.round((end.getTime() - start.getTime()) / 60000),
        MINUTES_IN_DAY,
      ),
    })
  })
  const laidOut = byDay.map(layoutColumns)

  // --- Dragging a block to a new time ---------------------------------------
  function beginDrag(event: PointerEvent<HTMLElement>, slot: ScheduleSlot) {
    if (event.button !== 0) return
    const columnWidth = body.current
      ? (body.current.getBoundingClientRect().width - GUTTER) / 7
      : 120
    setDrag({
      slot,
      originX: event.clientX,
      originY: event.clientY,
      columnWidth,
      offsetDays: 0,
      offsetMinutes: 0,
      moved: false,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onDragMove(event: PointerEvent<HTMLElement>) {
    if (!drag) return
    const dx = event.clientX - drag.originX
    const dy = event.clientY - drag.originY
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return

    const minutes = Math.round(dy / HOUR_HEIGHT * 60 / SNAP_MINUTES) * SNAP_MINUTES
    setDrag({
      ...drag,
      moved: true,
      offsetDays: Math.round(dx / drag.columnWidth),
      offsetMinutes: minutes,
    })
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    if (!drag) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const { slot, moved, offsetDays, offsetMinutes } = drag
    setDrag(null)

    if (!moved || (offsetDays === 0 && offsetMinutes === 0)) {
      onSelectSlot(slot)
      return
    }
    const start = new Date(slot.start_time)
    const end = new Date(slot.end_time)
    const shift = offsetDays * MINUTES_IN_DAY + offsetMinutes
    onMoveSlot(
      slot,
      new Date(start.getTime() + shift * 60000),
      new Date(end.getTime() + shift * 60000),
    )
  }

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
      <div ref={body} className="min-w-[760px]">
        <div className="sticky top-0 z-50 flex border-b border-sidebar-border bg-sidebar">
          <div className="shrink-0 border-r border-white/10" style={{ width: GUTTER }} />
          {days.map((day) => {
            const today = isSameDay(day, now)
            return (
              <div key={day.toISOString()}
                   className={cn('flex-1 border-r border-white/10 py-2 text-center last:border-r-0', today && 'bg-blue-500/10')}>
                <div className="text-xs text-sidebar-foreground/60">
                  {day.toLocaleDateString([], { weekday: 'short' })}
                </div>
                <div className={cn('text-lg font-semibold tnum', today ? 'text-blue-400' : 'text-sidebar-foreground/80')}>
                  {day.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex">
          <div className="relative shrink-0 border-r border-white/10" style={{ width: GUTTER, height: DAY_HEIGHT }}>
            {Array.from({ length: 24 }, (_, hour) => hour).map((hour) => (
              <span
                key={hour}
                className="absolute inset-x-0 flex items-center justify-center text-xs font-medium text-sidebar-foreground/60 tnum"
                style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                {new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' })}
              </span>
            ))}
          </div>

          {days.map((day, dayOffset) => (
            <div
              key={day.toISOString()}
              className={cn('relative flex-1 border-r border-white/10 last:border-r-0', isSameDay(day, now) && 'bg-blue-500/5')}
              style={{ height: DAY_HEIGHT }}
            >
              {focus
                .filter((span) => span.dayOffset === dayOffset)
                .map((span) => (
                  <div
                    key={span.id}
                    title={`${span.label}: you focus well here`}
                    className="absolute inset-x-0 bg-blue-500/[0.07]"
                    style={{ top: top(span.startMinute), height: height(span.endMinute - span.startMinute) }}
                  />
                ))}

              {Array.from({ length: 24 }, (_, index) => index).map((index) => (
                <div
                  key={index}
                  className="absolute inset-x-0 border-b border-white/10 transition-colors duration-200 hover:bg-white/5"
                  style={{ top: index * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                />
              ))}

              {busy
                .filter((span) => span.dayOffset === dayOffset)
                .map((span) => (
                  <div
                    key={span.id}
                    title={`${span.label}: the scheduler stays out of this`}
                    className="hatched pointer-events-none absolute inset-x-0 z-10 overflow-hidden px-2 pt-1 text-[11px] text-sidebar-foreground/40"
                    style={{ top: top(span.startMinute), height: height(span.endMinute - span.startMinute) }}
                  >
                    {span.endMinute - span.startMinute > 45 && span.label}
                  </div>
                ))}

              {laidOut[dayOffset].map((entry) => (
                <EventBlock
                  key={entry.slot.id}
                  entry={entry}
                  selected={selectedId === entry.slot.id}
                  drag={drag?.slot.id === entry.slot.id ? drag : null}
                  onSelect={() => onSelectSlot(entry.slot)}
                  onPointerDown={(event) => beginDrag(event, entry.slot)}
                  onPointerMove={onDragMove}
                  onPointerUp={endDrag}
                />
              ))}

              {isSameDay(day, now) && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-40"
                  style={{ top: top(minutesSinceMidnight(now)) }}
                >
                  <div className="h-0.5 bg-red-500" />
                  <div className="absolute -top-1 -left-1 size-2 rounded-full bg-red-500" />
                  <span className="sr-only">Now: {formatClock(now)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type PointerHandler = (event: PointerEvent<HTMLElement>) => void

interface EventBlockProps {
  entry: Entry
  selected: boolean
  drag: Drag | null
  onSelect: () => void
  onPointerDown: PointerHandler
  onPointerMove: PointerHandler
  onPointerUp: PointerHandler
}

function EventBlock({ entry, selected, drag, onSelect, onPointerDown, onPointerMove, onPointerUp }: EventBlockProps) {
  const { slot, startMinute, endMinute, column, columns } = entry
  const color = slot.overdue ? ALARM : typeColor(slot.task_type)
  const minutes = endMinute - startMinute
  const dragging = Boolean(drag?.moved)

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      title={[
        slot.parent_title ? `Part of ${slot.parent_title}` : slot.title,
        `Priority ${slot.priority_score.toFixed(2)}`,
        slot.requires_focus ? 'Needs your focused hours' : null,
        slot.recurring ? 'Repeats weekly' : null,
      ].filter(Boolean).join('\n')}
      className={cn(
        `absolute z-20 cursor-grab touch-none overflow-hidden rounded-md border-l-4 select-none`,
        dragging ? 'cursor-grabbing shadow-2xl' : 'transition-all duration-200 hover:shadow-lg hover:brightness-110',
        selected && 'ring-2',
      )}
      style={{
        top: top(startMinute) + (drag ? (drag.offsetMinutes / MINUTES_IN_DAY) * DAY_HEIGHT : 0),
        height: height(minutes),
        left: `calc(${(column / columns) * 100}% + 4px)`,
        width: `calc(${100 / columns}% - 8px)`,
        transform: drag ? `translateX(${drag.offsetDays * 100}%)` : undefined,
        background: `color-mix(in oklab, ${color} 30%, transparent)`,
        borderLeftColor: color,
        '--tw-ring-color': color,
      } as CSSProperties}
    >
      <div className="flex h-full flex-col justify-between p-2 text-xs">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate font-semibold text-white">
            {slot.recurring && <Repeat aria-label="Repeats weekly" className="size-2.5 shrink-0" />}
            <span className="truncate">{slot.title}</span>
          </p>
          {minutes >= 45 && (
            <p className="truncate text-xs text-white/70">
              {slot.parent_title ?? typeLabel(slot.task_type)}{slot.requires_focus ? ', needs focus' : ''}
            </p>
          )}
        </div>
        {minutes >= 60 && (
          <p className="text-xs font-medium text-white/60 tnum">{hhmm(slot.start_time)} - {hhmm(slot.end_time)}</p>
        )}
      </div>
    </div>
  )
}
