import { describe, expect, it } from 'vitest'

import type { Occurrence } from '@/types/api'
import {
  allDayRows, applyMove, applyResize, isAllDayLike, normaliseCreate, yToMinute,
} from './drag'
import { daysOfWeek } from './time'

const day = new Date(2026, 8, 16) // Wednesday
const at = (d: Date, minute: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minute)

const occ = (id: string, start: string, end: string, extra: Partial<Occurrence> = {}) => ({
  id, event_id: 1, calendar_id: 1, category_id: null, color_key: 'sky', title: id,
  description: '', location: '', start, end, all_day: false, busy: true, kind: 'default',
  recurring: false, original_start: null, ...extra,
}) as Occurrence

describe('yToMinute', () => {
  it('snaps to 15 minutes', () => {
    expect(yToMinute(64, 64)).toBe(60)
    expect(yToMinute(64 * 9.5 + 3, 64)).toBe(570)
    expect(yToMinute(64 * 9.5 + 10, 64)).toBe(585)
  })
  it('clamps to the day', () => {
    expect(yToMinute(-50, 64)).toBe(0)
    expect(yToMinute(64 * 30, 64)).toBe(1440)
  })
})

describe('normaliseCreate', () => {
  it('orders an upward drag', () => {
    const { start, end } = normaliseCreate(day, 600, 540)
    expect(start).toEqual(at(day, 540))
    expect(end).toEqual(at(day, 600))
  })
  it('turns a click into 60 minutes', () => {
    const { start, end } = normaliseCreate(day, 600, 600)
    expect(start).toEqual(at(day, 600))
    expect(end).toEqual(at(day, 660))
  })
  it('treats a sub-snap wobble as a click', () => {
    const { start, end } = normaliseCreate(day, 600, 605)
    expect(start).toEqual(at(day, 600))
    expect(end).toEqual(at(day, 660))
  })
  it('shifts a click near midnight back so the end stays on the day', () => {
    const { start, end } = normaliseCreate(day, 1410, 1410)
    expect(start).toEqual(at(day, 1380))
    expect(end).toEqual(at(day, 1440))
  })
  it('clamps a drag past midnight', () => {
    const { start, end } = normaliseCreate(day, 1300, 2000)
    expect(start).toEqual(at(day, 1300))
    expect(end).toEqual(at(day, 1440))
  })
  it('enforces the minimum length', () => {
    const { start, end } = normaliseCreate(day, 600, 615)
    expect(end.getTime() - start.getTime()).toBe(15 * 60000)
  })
})

describe('applyMove', () => {
  it('moves across days keeping the duration', () => {
    const start = at(day, 600)
    const end = at(day, 690)
    const moved = applyMove(start, end, 2, -30)
    expect(moved.start).toEqual(at(new Date(2026, 8, 18), 570))
    expect(moved.end).toEqual(at(new Date(2026, 8, 18), 660))
  })
  it('keeps wall-clock time over a DST change', () => {
    const start = new Date(2026, 2, 7, 10, 0) // US spring-forward is 8 Mar
    const moved = applyMove(start, new Date(2026, 2, 7, 11, 0), 2, 0)
    expect(moved.start).toEqual(new Date(2026, 2, 9, 10, 0))
    expect(moved.end).toEqual(new Date(2026, 2, 9, 11, 0))
  })
})

describe('applyResize', () => {
  it('changes only the end', () => {
    const r = applyResize(at(day, 600), at(day, 660), 30)
    expect(r.start).toEqual(at(day, 600))
    expect(r.end).toEqual(at(day, 690))
  })
  it('never goes below 15 minutes', () => {
    const r = applyResize(at(day, 600), at(day, 660), -200)
    expect(r.end).toEqual(at(day, 615))
  })
})

describe('isAllDayLike', () => {
  it('accepts the all_day flag', () => {
    expect(isAllDayLike({ all_day: true, start: '2026-09-16T00:00:00', end: '2026-09-17T00:00:00' })).toBe(true)
  })
  it('accepts a timed event of 24 hours or more', () => {
    expect(isAllDayLike({ all_day: false, start: '2026-09-16T10:00:00', end: '2026-09-18T10:00:00' })).toBe(true)
    expect(isAllDayLike({ all_day: false, start: '2026-09-16T10:00:00', end: '2026-09-17T10:00:00' })).toBe(true)
  })
  it('rejects a short overnight event', () => {
    expect(isAllDayLike({ all_day: false, start: '2026-09-16T23:30:00', end: '2026-09-17T07:30:00' })).toBe(false)
  })
})

describe('allDayRows', () => {
  const week = daysOfWeek(day)
  it('puts overlapping bars on different rows and spans multi-day bars', () => {
    const a = occ('a', '2026-09-15T00:00:00', '2026-09-18T00:00:00', { all_day: true }) // Tue-Thu
    const b = occ('b', '2026-09-16T00:00:00', '2026-09-17T00:00:00', { all_day: true }) // Wed
    const c = occ('c', '2026-09-18T00:00:00', '2026-09-19T00:00:00', { all_day: true }) // Fri
    const rows = allDayRows([b, c, a], week)
    const get = (id: string) => rows.find((r) => r.occurrence.id === id)!
    expect(get('a')).toMatchObject({ firstDay: 1, span: 3, row: 0 })
    expect(get('b')).toMatchObject({ firstDay: 2, span: 1, row: 1 })
    expect(get('c')).toMatchObject({ firstDay: 4, span: 1, row: 0 })
  })
  it('clips to the visible days and skips outside ones', () => {
    const three = [new Date(2026, 8, 16), new Date(2026, 8, 17), new Date(2026, 8, 18)]
    const long = occ('long', '2026-09-10T00:00:00', '2026-09-17T00:00:00', { all_day: true })
    const outside = occ('out', '2026-09-25T00:00:00', '2026-09-26T00:00:00', { all_day: true })
    const timed = occ('timed', '2026-09-16T09:00:00', '2026-09-16T10:00:00')
    const rows = allDayRows([long, outside, timed], three)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ firstDay: 0, span: 1, row: 0 })
  })
  it('includes a timed event of two days', () => {
    const two = occ('two', '2026-09-16T10:00:00', '2026-09-18T10:00:00')
    const rows = allDayRows([two], week)
    expect(rows[0]).toMatchObject({ firstDay: 2, span: 3 })
  })
})
