import { describe, expect, it } from 'vitest'

import type { Occurrence, ScheduleSlot } from '@/types/api'
import { groupByDay } from './schedule-list'

const occ = (id: string, start: string, end: string, extra: Partial<Occurrence> = {}) => ({
  id, event_id: 1, calendar_id: 1, category_id: null, color_key: 'sky', title: id,
  description: '', location: '', start, end, all_day: false, busy: true, kind: 'default',
  recurring: false, original_start: null, ...extra,
}) as Occurrence

const slot = (id: number, start: string, end: string) => ({
  id, title: `slot${id}`, start_time: start, end_time: end, task_type: 'other', color_key: null,
}) as ScheduleSlot

const start = new Date(2026, 9, 19) // Mon 19 Oct

describe('groupByDay', () => {
  it('omits empty days and sorts by start', () => {
    const groups = groupByDay(
      [occ('late', '2026-10-20T15:00:00', '2026-10-20T16:00:00')],
      [slot(1, '2026-10-20T09:00:00', '2026-10-20T10:00:00')],
      start, 7, new Date(2026, 9, 30),
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].day).toEqual(new Date(2026, 9, 20))
    expect(groups[0].items.map((i) => i.kind)).toEqual(['task', 'event'])
  })

  it('lists an overnight event on both days', () => {
    const groups = groupByDay(
      [occ('sleepish', '2026-10-20T23:00:00', '2026-10-21T07:00:00')],
      [], start, 7, new Date(2026, 9, 30),
    )
    expect(groups.map((g) => g.day.getDate())).toEqual([20, 21])
  })

  it('does not spill an event ending at midnight onto the next day', () => {
    const groups = groupByDay(
      [occ('a', '2026-10-20T22:00:00', '2026-10-21T00:00:00')], [], start, 7, new Date(2026, 9, 30),
    )
    expect(groups.map((g) => g.day.getDate())).toEqual([20])
  })

  it('puts all-day first and repeats multi-day all-day events', () => {
    const groups = groupByDay(
      [
        occ('timed', '2026-10-20T08:00:00', '2026-10-20T09:00:00'),
        occ('trip', '2026-10-20T00:00:00', '2026-10-22T00:00:00', { all_day: true }),
      ],
      [], start, 7, new Date(2026, 9, 30),
    )
    expect(groups.map((g) => g.day.getDate())).toEqual([20, 21])
    expect(groups[0].items.map((i) => (i.kind === 'event' ? i.occurrence.id : ''))).toEqual(['trip', 'timed'])
  })

  it('filters out routine occurrences', () => {
    const groups = groupByDay(
      [occ('sleep', '2026-10-20T23:00:00', '2026-10-21T07:00:00', { kind: 'routine' })],
      [], start, 7, new Date(2026, 9, 30),
    )
    expect(groups).toEqual([])
  })

  it('keeps an empty today when it is in range', () => {
    const groups = groupByDay([], [], start, 7, new Date(2026, 9, 21, 14, 0))
    expect(groups).toHaveLength(1)
    expect(groups[0].day).toEqual(new Date(2026, 9, 21))
    expect(groups[0].items).toEqual([])
  })

  it('ignores items outside the range', () => {
    const groups = groupByDay(
      [occ('far', '2026-11-20T08:00:00', '2026-11-20T09:00:00')], [], start, 7, new Date(2026, 9, 1),
    )
    expect(groups).toEqual([])
  })
})
