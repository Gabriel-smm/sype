// What the Today page shows, derived from the schedule and the task list.
// Pure functions so the boundaries (what counts as "now") are testable.

import { isSameDay } from './time'

const byStart = (a, b) => new Date(a.start_time) - new Date(b.start_time)

/**
 * Today's sessions around `now`: `earlier` (finished), `current` (running),
 * `later` (still to come). When today is empty from here on, `upcoming` is the
 * next session on a later day so the page can say when work resumes.
 */
export function todayAgenda(slots, now = new Date()) {
  const sorted = [...slots].sort(byStart)
  const today = sorted.filter((slot) => isSameDay(new Date(slot.start_time), now))

  const earlier = []
  const later = []
  let current = null
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
export function dueSoon(tasks, now = new Date(), days = 3) {
  const horizon = new Date(now.getTime() + days * 86400000)
  return tasks
    .filter((task) => task.status === 'pending' && new Date(task.due_date) <= horizon)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
}

/** A brand-new student has told the scheduler nothing about their week. */
export function setupNeeded(settings) {
  return !settings.fixed_blocks.length && !settings.productive_hours.length
}

/** Where one task's work landed after a rebuild, for the "Added …" toast. */
export function placementSummary(schedule, taskId) {
  const slots = schedule.slots.filter((slot) => slot.task_id === taskId).sort(byStart)
  return {
    sessions: slots.length,
    first: slots[0]?.start_time ?? null,
    missed: schedule.unschedulable.filter((item) => item.task_id === taskId).length,
  }
}
