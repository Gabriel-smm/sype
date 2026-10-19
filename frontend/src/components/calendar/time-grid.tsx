import { addDays } from 'date-fns'
import { Fragment, useLayoutEffect, useRef, type CSSProperties } from 'react'

import { useGridPointer, type DragTarget } from '@/hooks/use-grid-pointer'
import { useNow } from '@/hooks/use-now'
import { eventLook } from '@/lib/colors'
import { allDayRows, isAllDayLike } from '@/lib/drag'
import {
  expandRecurring,
  formatClock,
  formatTimeRange,
  isSameDay,
  layoutColumns,
  minutesSinceMidnight,
  occurrenceSpans,
  projectRange,
  weekStartOf,
  weekdayIndex,
  type DayPart,
} from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Occurrence, ProductiveWindow, ScheduleSlot } from '@/types/api'
import { AllDayRow } from './all-day-row'
import { EventChip, type ChipInteraction, type ChipPlacement } from './event-chip'
import { RoutineBand } from './routine-band'
import { TaskBlock } from './task-block'

const HOUR_HEIGHT = 48
const DAY_HEIGHT = HOUR_HEIGHT * 24
const GUTTER = 56
const OPEN_AT_HOUR = 7
/** Room kept free at the right of each day, so there is always somewhere to click and create. */
const RIGHT_GAP = 8

const px = (minutes: number) => (minutes / 60) * HOUR_HEIGHT

export type GridSelection = { kind: 'event'; id: string } | { kind: 'slot'; id: number } | null

interface TimeGridProps {
  days: Date[]
  /** Already filtered to the visible calendars. */
  occurrences: Occurrence[]
  slots: ScheduleSlot[]
  productiveHours: ProductiveWindow[]
  selected: GridSelection
  /** A draft being quick-created, kept on the grid while its popover is open. */
  draft?: { start: Date; end: Date } | null
  onSelectEvent: (occurrence: Occurrence, anchor: DOMRect) => void
  onSelectSlot: (slot: ScheduleSlot) => void
  onCreateDraft: (start: Date, end: Date, anchor: DOMRect) => void
  onMoveEvent: (occurrence: Occurrence, start: Date, end: Date) => void
  onResizeEvent: (occurrence: Occurrence, start: Date, end: Date) => void
  onMoveSlot: (slot: ScheduleSlot, start: Date, end: Date) => void
  onCompleteSlot: (slot: ScheduleSlot) => void
  onOpenDay: (day: Date) => void
}

type Item = DayPart & { key: string; target: DragTarget; last: boolean }

const rangeOf = (target: DragTarget) => target.kind === 'event'
  ? { start: new Date(target.occurrence.start), end: new Date(target.occurrence.end) }
  : { start: new Date(target.slot.start_time), end: new Date(target.slot.end_time) }

const keyOf = (target: DragTarget) =>
  target.kind === 'event' ? `e-${target.occurrence.id}` : `s-${target.slot.id}`

/** Split a range over the visible days, noting which part holds its end. */
function itemsFor(target: DragTarget, days: Date[]): Item[] {
  const { start, end } = rangeOf(target)
  return projectRange(start, end, days).map((part) => ({
    ...part,
    key: `${keyOf(target)}-${part.dayOffset}`,
    target,
    last: end <= addDays(days[part.dayOffset], 1),
  }))
}

/** The day, 3-day and week views: headers, all-day row, and the 24-hour grid. */
export function TimeGrid({
  days, occurrences, slots, productiveHours, selected, draft,
  onSelectEvent, onSelectSlot, onCreateDraft, onMoveEvent, onResizeEvent, onMoveSlot, onCompleteSlot, onOpenDay,
}: TimeGridProps) {
  const now = useNow()
  const scroller = useRef<HTMLDivElement>(null)
  const columns = useRef<HTMLDivElement>(null)

  // Open on the morning, with the 7 AM label just in view.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = px(OPEN_AT_HOUR * 60) - 8
  }, [])

  function select(target: DragTarget, anchor: HTMLElement) {
    if (target.kind === 'event') onSelectEvent(target.occurrence, anchor.getBoundingClientRect())
    else onSelectSlot(target.slot)
  }

  const gesture = useGridPointer({
    days,
    hourHeight: HOUR_HEIGHT,
    columns,
    onClick: select,
    onCreate: onCreateDraft,
    onMove: (target, start, end) => {
      if (target.kind === 'event') onMoveEvent(target.occurrence, start, end)
      else onMoveSlot(target.slot, start, end)
    },
    onResize: (target, start, end) => {
      if (target.kind === 'event') onResizeEvent(target.occurrence, start, end)
      else onMoveSlot(target.slot, start, end)
    },
  })
  const { preview } = gesture
  const dragged = preview && preview.type !== 'create' ? keyOf(preview.target) : null

  const routine = occurrences.filter((o) => eventLook(o) === 'routine')
  const allDay = occurrences.filter((o) => eventLook(o) !== 'routine' && isAllDayLike(o))
  const timed = occurrences.filter((o) => eventLook(o) !== 'routine' && !isAllDayLike(o))

  const routineSpans = occurrenceSpans(routine, days)
  // Productive windows recur weekly; their spans' dayOffset is the weekday (0 = Monday).
  const focus = expandRecurring(productiveHours, weekStartOf(days[0]), 'productive')
  const items = [
    ...timed.map((occurrence): DragTarget => ({ kind: 'event', occurrence })),
    ...slots.map((slot): DragTarget => ({ kind: 'slot', slot })),
  ].flatMap((target) => itemsFor(target, days))
  const laidOut = days.map((_, dayOffset) => layoutColumns(items.filter((item) => item.dayOffset === dayOffset)))
  const ghosts = preview && preview.type !== 'create'
    ? projectRange(preview.start, preview.end, days)
    : []
  const createGhost = preview?.type === 'create' ? preview : draft
  const createParts = createGhost ? projectRange(createGhost.start, createGhost.end, days) : []

  const isSelected = (target: DragTarget) => selected != null && (target.kind === 'event'
    ? selected.kind === 'event' && selected.id === target.occurrence.id
    : selected.kind === 'slot' && selected.id === target.slot.id)

  function renderChip(
    target: DragTarget, placement: ChipPlacement, interaction: ChipInteraction, range?: { start: Date; end: Date },
  ) {
    if (target.kind === 'event') {
      return <EventChip occurrence={target.occurrence} placement={placement} interaction={interaction} range={range} />
    }
    return (
      <TaskBlock slot={target.slot} placement={placement} interaction={interaction} range={range}
                 onComplete={() => onCompleteSlot(target.slot)} />
    )
  }

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-auto select-none">
      <div style={{ minWidth: days.length > 3 ? 640 : undefined }}>
        <div className="sticky top-0 z-40 bg-background">
          <div className="flex">
            <div className="shrink-0" style={{ width: GUTTER }} />
            {days.map((day) => {
              const today = isSameDay(day, now)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                  aria-current={today ? 'date' : undefined}
                  className="group flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-2 pb-1"
                >
                  <span className={cn('text-[11px] font-medium uppercase', today ? 'text-accent-ink' : 'text-faint')}>
                    {day.toLocaleDateString([], { weekday: 'short' })}
                  </span>
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full text-[26px] leading-none tnum',
                      today ? 'bg-primary text-primary-foreground' : 'text-foreground group-hover:bg-white/10',
                    )}
                  >
                    {day.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
          <AllDayRow
            days={days}
            bars={allDayRows(allDay, days)}
            gutter={GUTTER}
            selectedId={selected?.kind === 'event' ? selected.id : null}
            onSelect={onSelectEvent}
          />
        </div>

        <div className="flex">
          <div className="relative shrink-0" style={{ width: GUTTER, height: DAY_HEIGHT }} aria-hidden>
            {Array.from({ length: 23 }, (_, index) => index + 1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-faint tnum"
                style={{ top: px(hour * 60) }}
              >
                {new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' })}
              </span>
            ))}
          </div>

          <div ref={columns} className="flex min-w-0 flex-1" {...gesture.handlers}>
            {days.map((day, dayOffset) => {
              const weekday = weekdayIndex(day)
              return (
                <div
                  key={day.toISOString()}
                  className="relative min-w-0 flex-1 border-l border-white/10"
                  style={{
                    height: DAY_HEIGHT,
                    backgroundImage: 'linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
                    backgroundSize: `100% ${HOUR_HEIGHT}px`,
                  }}
                  onPointerDown={gesture.startCreate}
                >
                  {focus.filter((span) => span.dayOffset === weekday).map((span) => (
                    <div
                      key={span.id}
                      title={`${span.label}: you focus well here`}
                      className="absolute inset-x-0 bg-blue-500/[0.07]"
                      style={{ top: px(span.startMinute), height: px(span.endMinute - span.startMinute) }}
                    />
                  ))}

                  {routineSpans.filter((span) => span.dayOffset === dayOffset).map((span) => (
                    <RoutineBand key={span.id} occurrence={span.occurrence}
                                 top={px(span.startMinute)} height={px(span.endMinute - span.startMinute)} />
                  ))}

                  {laidOut[dayOffset].map((item) => {
                    const minutes = item.endMinute - item.startMinute
                    const editable = item.target.kind === 'slot' || !item.target.occurrence.recurring
                    const placement: ChipPlacement = {
                      minutes,
                      last: item.last && editable,
                      style: {
                        top: px(item.startMinute),
                        height: Math.max(px(minutes) - 1, 12),
                        left: `calc((100% - ${RIGHT_GAP}px) * ${item.column / item.columns})`,
                        width: `calc((100% - ${RIGHT_GAP}px) / ${item.columns} - 1px)`,
                      },
                    }
                    const target = item.target
                    return (
                      <Fragment key={item.key}>
                        {renderChip(target, placement, {
                          selected: isSelected(target),
                          faded: dragged === keyOf(target),
                          onSelect: (anchor) => select(target, anchor),
                          onPointerDown: (event) => gesture.startMove(event, target),
                          onResizePointerDown: (event, chip) => gesture.startResize(event, target, chip),
                        })}
                      </Fragment>
                    )
                  })}

                  {preview && preview.type !== 'create' && ghosts
                    .filter((part) => part.dayOffset === dayOffset)
                    .map((part) => (
                      <Fragment key={`ghost-${part.dayOffset}`}>
                        {renderChip(preview.target, {
                          minutes: part.endMinute - part.startMinute,
                          last: false,
                          style: {
                            top: px(part.startMinute),
                            height: Math.max(px(part.endMinute - part.startMinute) - 1, 12),
                            left: 0,
                            width: `calc(100% - ${RIGHT_GAP}px)`,
                          },
                        }, { selected: false, lifted: true, onSelect: () => {} }, preview)}
                      </Fragment>
                    ))}

                  {createGhost && createParts.filter((part) => part.dayOffset === dayOffset).map((part) => (
                    <GhostDraft key="draft" part={part} label={formatTimeRange(createGhost.start, createGhost.end)} />
                  ))}

                  {isSameDay(day, now) && (
                    <div className="pointer-events-none absolute inset-x-0 z-30"
                         style={{ top: px(minutesSinceMidnight(now)) - 1 }}>
                      <div className="h-0.5 bg-red-500" />
                      <div className="absolute -top-1 -left-[5px] size-2.5 rounded-full bg-red-500" />
                      <span className="sr-only">Now: {formatClock(now)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function GhostDraft({ part, label }: { part: DayPart; label: string }) {
  const style: CSSProperties = {
    top: px(part.startMinute),
    height: Math.max(px(part.endMinute - part.startMinute) - 1, 12),
    width: `calc(100% - ${RIGHT_GAP}px)`,
  }
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 z-30 overflow-hidden rounded-(--radius-event) bg-primary/30 px-1.5 pt-0.5 text-xs text-white tnum"
      style={style}
    >
      {label}
    </div>
  )
}
