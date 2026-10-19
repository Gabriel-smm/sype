// Where a newly added task's work landed after a rebuild, for the "Added …"
// toast. A pure function so it can be tested without the app.

import type { Schedule } from '@/types/api'

const byStart = (a: { start_time: string }, b: { start_time: string }) =>
  new Date(a.start_time).getTime() - new Date(b.start_time).getTime()

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
