// What the Today page shows, derived from the schedule and the task list.
// Pure functions so the boundaries (what counts as "now") are testable.

import type { Schedule, ScheduleSlot, Settings, Task } from '../types/api'
import { isSameDay } from './time'

const byStart = (a: { start_time: string }, b: { start_time: string }) =>
  new Date(a.start_time).getTime() - new Date(b.start_time).getTime()

/**
 * Today's sessions around `now`: `earlier` (finished), `current` (running),
 * `later` (still to come). When today is empty from here on, `upcoming` is the
 * next session on a later day so the page can say when work resumes.
 */
export interface Agenda {
  earlier: ScheduleSlot[]
  current: ScheduleSlot | null
  later: ScheduleSlot[]
  upcoming: ScheduleSlot | null
}

export function todayAgenda(slots: ScheduleSlot[], now = new Date()): Agenda {
  const sorted = [...slots].sort(byStart)
  const today = sorted.filter((slot) => isSameDay(new Date(slot.start_time), now))

  const earlier: ScheduleSlot[] = []
  const later: ScheduleSlot[] = []
  let current: ScheduleSlot | null = null
  for (const slot of today) {
    const start = new Date(slot.start_time)
    const end = new Date(slot.end_time)
    if (end <= now) earlier.push(slot)
    else if (start <= now && !current) current = slot
    else later.push(slot)
  }

  const upcoming = current || later.length
    ? null
    : sorted.find((slot) => new Date(slot.start_time) > now) ?? null

  return { earlier, current, later, upcoming }
}

/** Pending tasks due within `days`, plus anything already overdue. */
export function dueSoon(tasks: Task[], now = new Date(), days = 3): Task[] {
  const horizon = new Date(now.getTime() + days * 86400000)
  return tasks
    .filter((task) => task.status === 'pending' && new Date(task.due_date) <= horizon)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
}

/** A brand-new student has told the scheduler nothing about their week. */
export function setupNeeded(settings: Pick<Settings, 'fixed_blocks' | 'productive_hours'>): boolean {
  return !settings.fixed_blocks.length && !settings.productive_hours.length
}

/** Where one task's work landed after a rebuild, for the "Added …" toast. */
export interface PlacementSummary {
  sessions: number
  first: string | null
  missed: number
}

export function placementSummary(schedule: Schedule, taskId: number): PlacementSummary {
  const slots = schedule.slots.filter((slot) => slot.task_id === taskId).sort(byStart)
  return {
    sessions: slots.length,
    first: slots[0]?.start_time ?? null,
    missed: schedule.unschedulable.filter((item) => item.task_id === taskId).length,
  }
}
