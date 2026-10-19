import { describe, expect, it } from 'vitest'

import type { Schedule, ScheduleSlot, UnschedulableItem } from '@/types/api'
import { placementSummary } from './agenda'

// Fixtures carry only the fields under test.
const slot = (id: number, start: string, end: string, extra: Partial<ScheduleSlot> = {}) => ({
  id, task_id: id, subtask_id: null, title: `slot ${id}`,
  start_time: start, end_time: end, ...extra,
}) as ScheduleSlot

describe('placementSummary', () => {
  const schedule: Schedule = {
    slots: [
      slot(10, '2026-09-25T09:00:00', '2026-09-25T10:00:00', { task_id: 7 }),
      slot(11, '2026-09-24T14:00:00', '2026-09-24T16:00:00', { task_id: 7 }),
      slot(12, '2026-09-24T09:00:00', '2026-09-24T10:00:00', { task_id: 8 }),
    ],
    unschedulable: [{ task_id: 7, subtask_id: 3 }, { task_id: 9, subtask_id: null }] as UnschedulableItem[],
  }

  it('counts sessions and finds the earliest', () => {
    expect(placementSummary(schedule, 7)).toEqual({
      sessions: 2,
      first: '2026-09-24T14:00:00',
      missed: 1,
    })
  })

  it('reports work that did not fit at all', () => {
    expect(placementSummary(schedule, 9)).toEqual({ sessions: 0, first: null, missed: 1 })
  })
})
