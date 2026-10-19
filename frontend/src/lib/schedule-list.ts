import { addDays, startOfDay } from 'date-fns'

import type { Occurrence, ScheduleSlot } from '@/types/api'
import { isAllDayLike } from './drag'
import { isSameDay } from './time'

export type ScheduleItem =
  | { kind: 'event'; occurrence: Occurrence }
  | { kind: 'task'; slot: ScheduleSlot }

export interface DayGroup {
  day: Date
  items: ScheduleItem[]
}

const startOf = (item: ScheduleItem) =>
  new Date(item.kind === 'event' ? item.occurrence.start : item.slot.start_time).getTime()

const allDay = (item: ScheduleItem) => item.kind === 'event' && isAllDayLike(item.occurrence)

/**
 * Group events and task blocks by the days they overlap, for the schedule
 * list. Routine occurrences are left out. Days with nothing planned are
 * omitted, except `today` when it falls in range.
 */
export function groupByDay(
  occurrences: Occurrence[], slots: ScheduleSlot[], start: Date, days: number, today: Date,
): DayGroup[] {
  const items: { item: ScheduleItem; from: Date; to: Date }[] = [
    ...occurrences
      .filter((occurrence) => occurrence.kind !== 'routine')
      .map((occurrence) => ({
        item: { kind: 'event', occurrence } as ScheduleItem,
        from: new Date(occurrence.start), to: new Date(occurrence.end),
      })),
    ...slots.map((slot) => ({
      item: { kind: 'task', slot } as ScheduleItem,
      from: new Date(slot.start_time), to: new Date(slot.end_time),
    })),
  ]

  const first = startOfDay(start)
  const groups: DayGroup[] = []
  for (let offset = 0; offset < days; offset += 1) {
    const day = addDays(first, offset)
    const next = addDays(day, 1)
    const here = items
      .filter(({ from, to }) => from < next && (to > day || (to.getTime() === from.getTime() && from >= day)))
      .map(({ item }) => item)
      .sort((a, b) => Number(allDay(b)) - Number(allDay(a)) || startOf(a) - startOf(b))
    if (here.length || isSameDay(day, today)) groups.push({ day, items: here })
  }
  return groups
}

/** Whether `item` is the current selection (the shape the calendar views share). */
export function itemSelected(
  item: ScheduleItem, selected: { kind: 'event'; id: string } | { kind: 'slot'; id: number } | null,
): boolean {
  if (!selected) return false
  return item.kind === 'event'
    ? selected.kind === 'event' && selected.id === item.occurrence.id
    : selected.kind === 'slot' && selected.id === item.slot.id
}
