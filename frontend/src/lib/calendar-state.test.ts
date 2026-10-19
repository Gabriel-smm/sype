import { describe, expect, it } from 'vitest'

import type { Occurrence } from '@/types/api'
import { applyOptimisticMove, removeOccurrence, withoutCalendar } from './calendar-state'

const occ = (id: string, calendar_id = 1, start = '2026-09-16T09:00:00', end = '2026-09-16T10:00:00') =>
  ({
    id, event_id: 1, calendar_id, category_id: null, color_key: 'sky', title: id,
    description: '', location: '', start, end, all_day: false, busy: true, kind: 'default',
    recurring: false, original_start: null,
  }) as Occurrence

describe('applyOptimisticMove', () => {
  it('replaces start and end of the matching occurrence only', () => {
    const list = [occ('a'), occ('b')]
    const next = applyOptimisticMove(list, 'a', new Date(2026, 8, 17, 14, 0), new Date(2026, 8, 17, 15, 30))
    expect(next[0].start).toBe('2026-09-17T14:00:00')
    expect(next[0].end).toBe('2026-09-17T15:30:00')
    expect(next[1]).toBe(list[1])
    expect(list[0].start).toBe('2026-09-16T09:00:00')
  })

  it('rolls back by re-applying the previous values', () => {
    const list = [occ('a')]
    const moved = applyOptimisticMove(list, 'a', new Date(2026, 8, 18, 8, 0), new Date(2026, 8, 18, 9, 0))
    const back = applyOptimisticMove(moved, 'a', new Date(list[0].start), new Date(list[0].end))
    expect(back).toEqual(list)
  })

  it('leaves the list unchanged for an unknown id', () => {
    const list = [occ('a')]
    expect(applyOptimisticMove(list, 'zzz', new Date(2026, 8, 18), new Date(2026, 8, 19))).toEqual(list)
  })
})

describe('withoutCalendar', () => {
  const list = [occ('a', 1), occ('b', 2), occ('c', 3)]
  it('drops hidden calendars (set or array)', () => {
    expect(withoutCalendar(list, new Set([2])).map((o) => o.id)).toEqual(['a', 'c'])
    expect(withoutCalendar(list, [1, 3]).map((o) => o.id)).toEqual(['b'])
  })
  it('keeps everything when nothing is hidden', () => {
    expect(withoutCalendar(list, [])).toEqual(list)
  })
})

describe('removeOccurrence', () => {
  it('removes by id without mutating', () => {
    const list = [occ('a'), occ('b')]
    expect(removeOccurrence(list, 'a').map((o) => o.id)).toEqual(['b'])
    expect(list).toHaveLength(2)
  })
})
