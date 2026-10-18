// What the Today page shows, derived from the schedule and the task list.
// Pure functions so the boundaries (what counts as "now") are testable.

import type { Schedule, ScheduleSlot, Settings, Task } from '@/types/api'
import { daysOfWeek, isSameDay } from './time'

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

const minutesOf = (slot: ScheduleSlot) =>
  (new Date(slot.end_time).getTime() - new Date(slot.start_time).getTime()) / 60000

const byDue = (a: Task, b: Task) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()

/**
 * The few sessions that matter most today. Anything still on today's calendar
 * is unresolved (done and skipped work leaves the schedule), so earlier,
 * running and later sessions all compete, ranked by the scheduler's score.
 */
export function topPriorities(slots: ScheduleSlot[], now = new Date(), n = 3): { top: ScheduleSlot[]; more: number } {
  const ranked = slots
    .filter((slot) => isSameDay(new Date(slot.start_time), now))
    .sort((a, b) => b.priority_score - a.priority_score || byStart(a, b))
  return { top: ranked.slice(0, n), more: Math.max(ranked.length - n, 0) }
}

/** One day's sessions in order, the time they add up to, and what falls due that day. */
export interface DayPlan {
  slots: ScheduleSlot[]
  minutes: number
  due: Task[]
}

export function dayPlan(slots: ScheduleSlot[], tasks: Task[], day: Date): DayPlan {
  const daySlots = slots.filter((slot) => isSameDay(new Date(slot.start_time), day)).sort(byStart)
  return {
    slots: daySlots,
    minutes: daySlots.reduce((sum, slot) => sum + minutesOf(slot), 0),
    due: tasks.filter((task) => task.status === 'pending' && isSameDay(new Date(task.due_date), day)).sort(byDue),
  }
}

/** The week containing `date`, Monday first, as seven day plans. */
export function weekSummary(slots: ScheduleSlot[], tasks: Task[], date: Date): (DayPlan & { day: Date })[] {
  return daysOfWeek(date).map((day) => ({ day, ...dayPlan(slots, tasks, day) }))
}

/** The assignments that carry the most weight in the next `days`, with their step progress. */
export interface Assignment {
  task: Task
  steps: number
  stepsDone: number
}

export function majorAssignments(tasks: Task[], now = new Date(), limit = 3, days = 14): Assignment[] {
  const horizon = now.getTime() + days * 86400000
  return tasks
    .filter((task) => task.status === 'pending' && task.recurring_task_id == null && task.task_type !== 'routine'
      && new Date(task.due_date).getTime() <= horizon)
    .sort((a, b) => b.grade_weight - a.grade_weight || byDue(a, b))
    .slice(0, limit)
    .map((task) => {
      const steps = task.subtasks ?? []
      return { task, steps: steps.length, stepsDone: steps.filter((step) => step.status === 'done').length }
    })
}

/**
 * The hours the compact week view draws: a waking day by default, widened
 * just enough to show any session this week that falls outside it.
 */
export function glanceHours(slots: ScheduleSlot[], days: Date[]): { start: number; end: number } {
  let start = 7
  let end = 23
  for (const slot of slots) {
    const from = new Date(slot.start_time)
    if (!days.some((day) => isSameDay(day, from))) continue
    const to = new Date(slot.end_time)
    const endHour = isSameDay(from, to) ? to.getHours() + to.getMinutes() / 60 : 24
    start = Math.min(start, from.getHours())
    end = Math.max(end, Math.ceil(endHour))
  }
  return { start, end }
}
