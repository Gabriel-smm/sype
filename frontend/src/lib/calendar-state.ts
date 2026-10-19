// Pure list transforms behind the calendar hook's optimistic updates.
import type { Occurrence } from '@/types/api'

import { toApiDateTime } from './time'

/** A new list with one occurrence's start and end replaced. Re-applying the old values is the rollback. */
export function applyOptimisticMove(
  list: Occurrence[], occurrenceId: string, start: Date, end: Date,
): Occurrence[] {
  return list.map((o) =>
    o.id === occurrenceId ? { ...o, start: toApiDateTime(start), end: toApiDateTime(end) } : o)
}

export function withoutCalendar(list: Occurrence[], hiddenIds: Set<number> | number[]): Occurrence[] {
  const hidden = hiddenIds instanceof Set ? hiddenIds : new Set(hiddenIds)
  return hidden.size === 0 ? list : list.filter((o) => !hidden.has(o.calendar_id))
}

export function removeOccurrence(list: Occurrence[], occurrenceId: string): Occurrence[] {
  return list.filter((o) => o.id !== occurrenceId)
}
