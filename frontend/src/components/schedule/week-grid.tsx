import { Repeat } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

import { useNow } from '@/hooks/use-now'
import { ALARM, typeColor } from '@/lib/task-meta'
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
const GUTTER = 56

const top = (minute: number) => (minute / MINUTES_IN_DAY) * DAY_HEIGHT
const height = (minutes: number) => Math.max((minutes / MINUTES_IN_DAY) * DAY_HEIGHT, 16)

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
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR_HEIGHT
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
    <div ref={scroller} className="glass min-h-0 flex-1 overflow-auto rounded-3xl bg-white/[0.02]">
      <div ref={body} className="min-w-[760px]">
        <div className="sticky top-0 z-50 flex border-b border-white/[0.08] bg-[#070707]">
          <div className="shrink-0" style={{ width: GUTTER }} />
          {days.map((day) => {
            const today = isSameDay(day, now)
            return (
              <div key={day.toISOString()} className="flex flex-1 items-baseline justify-center gap-1.5 py-3">
                <span className={cn('text-xs', today ? 'text-accent-ink' : 'text-faint')}>
                  {day.toLocaleDateString([], { weekday: 'short' })}
                </span>
                <span
                  className={cn('grid size-7 place-items-center rounded-full text-sm tnum',
                    today ? 'bg-primary font-semibold text-white' : 'text-muted-foreground')}
                >
                  {day.getDate()}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex">
          <div className="relative shrink-0" style={{ width: GUTTER, height: DAY_HEIGHT }}>
            {Array.from({ length: 23 }, (_, index) => index + 1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2.5 -translate-y-1/2 text-[11px] text-faint tnum"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' })}
              </span>
            ))}
          </div>

          {days.map((day, dayOffset) => (
            <div
              key={day.toISOString()}
              className={cn('relative flex-1 border-l border-white/[0.06]', isSameDay(day, now) && 'bg-white/[0.015]')}
              style={{ height: DAY_HEIGHT }}
            >
              {focus
                .filter((span) => span.dayOffset === dayOffset)
                .map((span) => (
                  <div
                    key={span.id}
                    title={`${span.label}: you focus well here`}
                    className="absolute inset-x-0 bg-blue-500/[0.08]"
                    style={{ top: top(span.startMinute), height: height(span.endMinute - span.startMinute) }}
                  />
                ))}

              {Array.from({ length: 24 }, (_, index) => index).map((index) => (
                <div
                  key={index}
                  className="pointer-events-none absolute inset-x-0 border-t border-white/[0.05]"
                  style={{ top: index * HOUR_HEIGHT }}
                />
              ))}

              {busy
                .filter((span) => span.dayOffset === dayOffset)
                .map((span) => (
                  <div
                    key={span.id}
                    title={`${span.label}: the scheduler stays out of this`}
                    className="hatched absolute inset-x-0 z-10 overflow-hidden px-2 pt-1 text-[11px] text-faint"
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
                  <div className="h-0.5 bg-accent-ink shadow-[0_0_12px_rgba(96,165,250,0.8)]" />
                  <div className="absolute -top-[4px] -left-[5px] size-2.5 rounded-full bg-accent-ink" />
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
        `absolute z-20 cursor-grab touch-none overflow-hidden rounded-xl border px-2 py-1 text-xs
         leading-tight select-none`,
        dragging ? 'cursor-grabbing shadow-2xl' : 'transition-[filter] hover:brightness-125',
        selected && 'ring-2',
      )}
      style={{
        top: top(startMinute) + (drag ? (drag.offsetMinutes / MINUTES_IN_DAY) * DAY_HEIGHT : 0),
        height: height(minutes),
        left: `calc(${(column / columns) * 100}% + 3px)`,
        width: `calc(${100 / columns}% - 5px)`,
        transform: drag ? `translateX(${drag.offsetDays * 100}%)` : undefined,
        background: `color-mix(in oklab, ${color} 22%, #050505)`,
        borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
        color: `color-mix(in oklab, ${color} 45%, white)`,
        '--tw-ring-color': color,
      } as CSSProperties}
    >
      <div className="flex items-center gap-1 font-medium">
        {slot.requires_focus && (
          <span aria-label="Needs focus" className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
        )}
        {slot.recurring && <Repeat aria-label="Repeats weekly" className="size-2.5 shrink-0" style={{ color }} />}
        <span className="truncate">{slot.title}</span>
      </div>
      {minutes >= 50 && (
        <div className="mt-0.5 flex items-baseline gap-1.5 truncate text-[11px]">
          <span className="opacity-70 tnum">{formatClock(new Date(slot.start_time))}</span>
          {slot.parent_title && <span className="truncate opacity-50">{slot.parent_title}</span>}
        </div>
      )}
    </div>
  )
}
