import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  MINUTES_IN_DAY,
  daysOfWeek,
  expandRecurring,
  formatClock,
  isSameDay,
  layoutColumns,
  minutesSinceMidnight,
  weekStartOf,
} from '../../lib/time'
import { ALARM, typeColor } from '../../lib/taskMeta'

const HOUR_HEIGHT = 46
const DAY_HEIGHT = HOUR_HEIGHT * 24
const SNAP_MINUTES = 15
const DRAG_THRESHOLD = 4

const top = (minute) => (minute / MINUTES_IN_DAY) * DAY_HEIGHT
const height = (minutes) => Math.max((minutes / MINUTES_IN_DAY) * DAY_HEIGHT, 15)

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export default function WeekGrid({
  slots, fixedBlocks, productiveHours, date, selectedId, onSelectSlot, onMoveSlot,
}) {
  const now = useNow()
  const scroller = useRef(null)
  const body = useRef(null)
  const [drag, setDrag] = useState(null)

  const weekStart = weekStartOf(date)
  const days = daysOfWeek(date)

  // Open on the working day rather than at midnight.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR_HEIGHT
  }, [])

  const busy = expandRecurring(fixedBlocks, weekStart, 'fixed')
  const focus = expandRecurring(productiveHours, weekStart, 'productive')

  // Work blocks, bucketed by the day column they belong to.
  const byDay = days.map(() => [])
  slots.forEach((slot) => {
    const start = new Date(slot.start_time)
    const end = new Date(slot.end_time)
    const dayOffset = days.findIndex((day) => isSameDay(day, start))
    if (dayOffset === -1) return
    byDay[dayOffset].push({
      slot,
      startMinute: minutesSinceMidnight(start),
      endMinute: Math.min(
        minutesSinceMidnight(start) + Math.round((end - start) / 60000),
        MINUTES_IN_DAY,
      ),
    })
  })
  const laidOut = byDay.map(layoutColumns)

  // --- Dragging a block to a new time ---------------------------------------
  function beginDrag(event, slot) {
    if (event.button !== 0) return
    const columnWidth = body.current
      ? (body.current.getBoundingClientRect().width - 56) / 7
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

  function onDragMove(event) {
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

  function endDrag(event) {
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
    <div ref={scroller} className="flex-1 overflow-auto rounded-xl border border-ink-700 bg-ink-900">
      <div ref={body} className="min-w-[720px]">
        <div className="sticky top-0 z-30 flex border-b border-ink-700 bg-ink-900/95 backdrop-blur">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const today = isSameDay(day, now)
            return (
              <div key={day.toISOString()} className="flex-1 border-l border-ink-800 py-2 text-center">
                <div className={`text-[11px] ${today ? 'text-lamp' : 'text-chalk-faint'}`}>
                  {day.toLocaleDateString([], { weekday: 'short' })}
                </div>
                <div
                  className={`mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-[15px] tnum ${
                    today ? 'bg-lamp font-semibold text-ink-950' : 'text-chalk-dim'
                  }`}
                >
                  {day.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex">
          <div className="relative w-14 shrink-0" style={{ height: DAY_HEIGHT }}>
            {Array.from({ length: 23 }, (_, index) => index + 1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-chalk-faint tnum"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' })}
              </span>
            ))}
          </div>

          {days.map((day, dayOffset) => (
            <div
              key={day.toISOString()}
              className="relative flex-1 border-l border-ink-800"
              style={{ height: DAY_HEIGHT }}
            >
              {focus
                .filter((span) => span.dayOffset === dayOffset)
                .map((span) => (
                  <div
                    key={span.id}
                    title={`${span.label} — you focus well here`}
                    className="absolute inset-x-0 bg-lamp/[0.085]"
                    style={{
                      top: top(span.startMinute),
                      height: height(span.endMinute - span.startMinute),
                    }}
                  />
                ))}

              {Array.from({ length: 48 }, (_, index) => index).map((index) => (
                <div
                  key={index}
                  className={`pointer-events-none absolute inset-x-0 border-t ${
                    index % 2 === 0 ? 'border-ink-800' : 'border-ink-800/40'
                  }`}
                  style={{ top: (index * HOUR_HEIGHT) / 2 }}
                />
              ))}

              {busy
                .filter((span) => span.dayOffset === dayOffset)
                .map((span) => (
                  <div
                    key={span.id}
                    title={`${span.label} — the scheduler stays out of this`}
                    className="hatched absolute inset-x-0 z-10 overflow-hidden border-y border-ink-700
                               px-1.5 pt-0.5 text-[10px] text-chalk-faint"
                    style={{
                      top: top(span.startMinute),
                      height: height(span.endMinute - span.startMinute),
                    }}
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
                  <div className="h-px bg-lamp" />
                  <div className="absolute -top-[3px] -left-[3px] size-[7px] rounded-full bg-lamp" />
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

function EventBlock({ entry, selected, drag, onSelect, onPointerDown, onPointerMove, onPointerUp }) {
  const { slot, startMinute, endMinute, column, columns } = entry
  const color = slot.overdue ? ALARM : typeColor(slot.task_type)
  const minutes = endMinute - startMinute
  const dragging = Boolean(drag?.moved)

  const width = `calc(${100 / columns}% - 3px)`
  const left = `calc(${(column / columns) * 100}% + 2px)`

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
      className={`absolute z-20 cursor-grab touch-none overflow-hidden rounded-[5px] px-1.5 py-0.5
                  text-[11px] leading-tight select-none
                  ${dragging ? 'cursor-grabbing opacity-90 shadow-lg' : 'transition-[filter] hover:brightness-125'}
                  ${selected ? 'ring-1' : ''}`}
      style={{
        top: top(startMinute) + (drag ? (drag.offsetMinutes / MINUTES_IN_DAY) * DAY_HEIGHT : 0),
        height: height(minutes),
        left,
        width,
        transform: drag ? `translateX(${drag.offsetDays * 100}%)` : undefined,
        background: `color-mix(in srgb, ${color} 20%, var(--color-ink-900))`,
        borderLeft: `3px solid ${color}`,
        color: `color-mix(in srgb, ${color} 55%, white)`,
        '--tw-ring-color': color,
      }}
    >
      <div className="flex items-center gap-1 font-medium">
        {slot.requires_focus && (
          <span
            aria-label="Needs focus"
            className="size-[5px] shrink-0 rounded-full"
            style={{ background: color }}
          />
        )}
        {slot.recurring && (
          <span aria-label="Repeats weekly" className="shrink-0" style={{ color }}>
            <svg viewBox="0 0 14 14" width="8" height="8" fill="none" stroke="currentColor"
                 strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6.5A5 5 0 0111.5 4.3M12 2v2.5H9.5" />
              <path d="M12 7.5a5 5 0 01-9.5 2.2M2 12v-2.5h2.5" />
            </svg>
          </span>
        )}
        <span className="truncate">{slot.title}</span>
      </div>
      {minutes >= 50 && (
        <div className="flex items-baseline gap-1.5 truncate text-[10px]">
          <span className="opacity-70 tnum">{formatClock(new Date(slot.start_time))}</span>
          {slot.parent_title && <span className="truncate opacity-45">{slot.parent_title}</span>}
        </div>
      )}
    </div>
  )
}
