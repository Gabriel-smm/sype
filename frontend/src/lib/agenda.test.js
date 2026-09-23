import { describe, expect, it } from 'vitest'

import { dueSoon, placementSummary, setupNeeded, todayAgenda } from './agenda'

// Wednesday 23 September 2026, 14:30 local.
const NOW = new Date(2026, 8, 23, 14, 30)

const slot = (id, start, end, extra = {}) => ({
  id, task_id: id, subtask_id: null, title: `slot ${id}`,
  start_time: start, end_time: end, ...extra,
})

describe('todayAgenda', () => {
  const slots = [
    slot(1, '2026-09-23T09:00:00', '2026-09-23T10:00:00'),
    slot(2, '2026-09-23T14:00:00', '2026-09-23T15:30:00'),
    slot(3, '2026-09-23T19:00:00', '2026-09-23T20:00:00'),
    slot(4, '2026-09-23T16:00:00', '2026-09-23T17:00:00'),
    slot(5, '2026-09-24T09:00:00', '2026-09-24T10:00:00'),
    slot(6, '2026-09-22T09:00:00', '2026-09-22T10:00:00'),
  ]

  it('splits today around now, in time order', () => {
    const agenda = todayAgenda(slots, NOW)
    expect(agenda.current?.id).toBe(2)
    expect(agenda.later.map((s) => s.id)).toEqual([4, 3])
    expect(agenda.earlier.map((s) => s.id)).toEqual([1])
  })

  it('has no current session in a gap', () => {
    const agenda = todayAgenda(slots, new Date(2026, 8, 23, 15, 45))
    expect(agenda.current).toBeNull()
    expect(agenda.later.map((s) => s.id)).toEqual([4, 3])
  })

  it('counts a session that starts exactly now as current', () => {
    expect(todayAgenda(slots, new Date(2026, 8, 23, 16, 0)).current?.id).toBe(4)
  })

  it('finds the first session after today when today is done', () => {
    const agenda = todayAgenda(slots, new Date(2026, 8, 23, 21, 0))
    expect(agenda.current).toBeNull()
    expect(agenda.later).toEqual([])
    expect(agenda.upcoming?.id).toBe(5)
  })

  it('offers no upcoming session while today still has some', () => {
    expect(todayAgenda(slots, NOW).upcoming).toBeNull()
  })
})

describe('dueSoon', () => {
  const task = (id, due, status = 'pending') => ({ id, due_date: due, status })
  const tasks = [
    task(1, '2026-09-30T23:59:00'),
    task(2, '2026-09-25T17:00:00'),
    task(3, '2026-09-20T23:59:00'),
    task(4, '2026-09-24T09:00:00', 'done'),
    task(5, '2026-09-26T14:00:00'),
  ]

  it('keeps pending work due within the window plus anything overdue, soonest first', () => {
    expect(dueSoon(tasks, NOW).map((t) => t.id)).toEqual([3, 2, 5])
  })

  it('takes a window in days', () => {
    expect(dueSoon(tasks, NOW, 8).map((t) => t.id)).toEqual([3, 2, 5, 1])
  })
})

describe('setupNeeded', () => {
  it('is true only when neither busy blocks nor focus hours exist', () => {
    expect(setupNeeded({ fixed_blocks: [], productive_hours: [] })).toBe(true)
    expect(setupNeeded({ fixed_blocks: [{}], productive_hours: [] })).toBe(false)
    expect(setupNeeded({ fixed_blocks: [], productive_hours: [{}] })).toBe(false)
  })
})

describe('placementSummary', () => {
  const schedule = {
    slots: [
      slot(10, '2026-09-25T09:00:00', '2026-09-25T10:00:00', { task_id: 7 }),
      slot(11, '2026-09-24T14:00:00', '2026-09-24T16:00:00', { task_id: 7 }),
      slot(12, '2026-09-24T09:00:00', '2026-09-24T10:00:00', { task_id: 8 }),
    ],
    unschedulable: [{ task_id: 7, subtask_id: 3 }, { task_id: 9, subtask_id: null }],
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
