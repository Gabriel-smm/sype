import { describe, expect, it } from 'vitest'

import type { FixedBlock, ProductiveWindow, Schedule, ScheduleSlot, Task, UnschedulableItem } from '@/types/api'
import {
  dayPlan, dueSoon, glanceHours, majorAssignments, placementSummary, setupNeeded, todayAgenda, topPriorities,
  weekSummary,
} from './agenda'
import { daysOfWeek } from './time'

// Wednesday 23 September 2026, 14:30 local.
const NOW = new Date(2026, 8, 23, 14, 30)

// Fixtures carry only the fields under test.
const slot = (id: number, start: string, end: string, extra: Partial<ScheduleSlot> = {}) => ({
  id, task_id: id, subtask_id: null, title: `slot ${id}`,
  start_time: start, end_time: end, ...extra,
}) as ScheduleSlot

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
  const task = (id: number, due: string, status = 'pending') =>
    ({ id, due_date: due, status }) as Task
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
    expect(setupNeeded({ fixed_blocks: [{} as FixedBlock], productive_hours: [] })).toBe(false)
    expect(setupNeeded({ fixed_blocks: [], productive_hours: [{} as ProductiveWindow] })).toBe(false)
  })
})

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

describe('topPriorities', () => {
  const slots = [
    slot(1, '2026-09-23T09:00:00', '2026-09-23T10:00:00', { priority_score: 0.4 }),
    slot(2, '2026-09-23T14:00:00', '2026-09-23T15:30:00', { priority_score: 0.9 }),
    slot(3, '2026-09-23T19:00:00', '2026-09-23T20:00:00', { priority_score: 0.7 }),
    slot(4, '2026-09-23T16:00:00', '2026-09-23T17:00:00', { priority_score: 0.7 }),
    slot(5, '2026-09-23T20:00:00', '2026-09-23T21:00:00', { priority_score: 0.1 }),
    slot(6, '2026-09-24T09:00:00', '2026-09-24T10:00:00', { priority_score: 1 }),
  ]

  it('ranks today\'s open sessions by score, earlier start breaking ties', () => {
    expect(topPriorities(slots, NOW).top.map((s) => s.id)).toEqual([2, 4, 3])
  })

  it('counts what is left beyond the top few', () => {
    expect(topPriorities(slots, NOW).more).toBe(2)
    expect(topPriorities(slots, NOW, 5).more).toBe(0)
  })

  it('ignores other days', () => {
    expect(topPriorities(slots, NOW, 10).top.map((s) => s.id)).not.toContain(6)
  })
})

describe('dayPlan', () => {
  const tomorrow = new Date(2026, 8, 24)
  const slots = [
    slot(1, '2026-09-24T13:00:00', '2026-09-24T14:30:00'),
    slot(2, '2026-09-24T09:00:00', '2026-09-24T10:00:00'),
    slot(3, '2026-09-23T09:00:00', '2026-09-23T10:00:00'),
  ]
  const tasks = [
    { id: 1, due_date: '2026-09-24T23:59:00', status: 'pending' },
    { id: 2, due_date: '2026-09-24T09:00:00', status: 'pending' },
    { id: 3, due_date: '2026-09-24T12:00:00', status: 'done' },
    { id: 4, due_date: '2026-09-25T09:00:00', status: 'pending' },
  ] as Task[]

  it('lists that day\'s sessions in time order with the total', () => {
    const plan = dayPlan(slots, tasks, tomorrow)
    expect(plan.slots.map((s) => s.id)).toEqual([2, 1])
    expect(plan.minutes).toBe(150)
  })

  it('lists pending work due that day, soonest first', () => {
    expect(dayPlan(slots, tasks, tomorrow).due.map((t) => t.id)).toEqual([2, 1])
  })
})

describe('weekSummary', () => {
  const slots = [
    slot(1, '2026-09-21T09:00:00', '2026-09-21T11:00:00'),
    slot(2, '2026-09-23T14:00:00', '2026-09-23T14:30:00'),
    slot(3, '2026-09-28T09:00:00', '2026-09-28T10:00:00'),
  ]
  const tasks = [{ id: 1, due_date: '2026-09-27T23:59:00', status: 'pending' }] as Task[]

  it('gives seven days, Monday first, with minutes planned and work due', () => {
    const week = weekSummary(slots, tasks, NOW)
    expect(week).toHaveLength(7)
    expect(week.map((d) => d.minutes)).toEqual([120, 0, 30, 0, 0, 0, 0])
    expect(week[6].due.map((t) => t.id)).toEqual([1])
  })
})

describe('majorAssignments', () => {
  const task = (id: number, extra: Partial<Task>) =>
    ({ id, status: 'pending', task_type: 'essay_project', recurring_task_id: null, subtasks: [],
       grade_weight: 0, due_date: '2026-09-25T23:59:00', ...extra }) as Task
  const tasks = [
    task(1, { grade_weight: 10 }),
    task(2, { grade_weight: 30, due_date: '2026-09-30T23:59:00' }),
    task(3, { grade_weight: 30, due_date: '2026-09-26T23:59:00' }),
    task(4, { grade_weight: 50, due_date: '2026-10-20T23:59:00' }),
    task(5, { grade_weight: 90, recurring_task_id: 2, task_type: 'routine' }),
    task(6, { grade_weight: 90, status: 'done' }),
    task(7, { grade_weight: 5 }),
  ]

  it('picks pending one-off work due within two weeks, heaviest first, then soonest', () => {
    expect(majorAssignments(tasks, NOW).map((a) => a.task.id)).toEqual([3, 2, 1])
  })

  it('counts finished steps', () => {
    const withSteps = task(8, {
      grade_weight: 99,
      subtasks: [{ status: 'done' }, { status: 'pending' }, { status: 'skipped' }] as Task['subtasks'],
    })
    expect(majorAssignments([withSteps], NOW)[0]).toMatchObject({ steps: 3, stepsDone: 1 })
  })
})

describe('glanceHours', () => {
  const days = daysOfWeek(NOW)

  it('shows 7 to 23 by default', () => {
    expect(glanceHours([], days)).toEqual({ start: 7, end: 23 })
  })

  it('widens to fit sessions outside that range this week', () => {
    const slots = [
      slot(1, '2026-09-22T05:30:00', '2026-09-22T06:30:00'),
      slot(2, '2026-09-24T22:00:00', '2026-09-24T23:15:00'),
      slot(3, '2026-09-30T02:00:00', '2026-09-30T03:00:00'),
    ]
    expect(glanceHours(slots, days)).toEqual({ start: 5, end: 24 })
  })
})
