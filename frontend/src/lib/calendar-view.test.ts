import { describe, expect, it } from 'vitest'

import {
  monthGrid,
  parseViewParams,
  rangeFor,
  step,
  titleFor,
  toViewParams,
  VIEWS,
} from './calendar-view'
import { isSameDay } from './time'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('rangeFor', () => {
  it('day is that day, half-open', () => {
    const r = rangeFor('day', new Date(2026, 9, 19, 15, 30))
    expect(r.start).toEqual(d(2026, 10, 19))
    expect(r.end).toEqual(d(2026, 10, 20))
    expect(r.days).toEqual([d(2026, 10, 19)])
  })

  it('3day covers date..+2', () => {
    const r = rangeFor('3day', d(2026, 10, 30))
    expect(r.start).toEqual(d(2026, 10, 30))
    expect(r.end).toEqual(d(2026, 11, 2))
    expect(r.days).toEqual([d(2026, 10, 30), d(2026, 10, 31), d(2026, 11, 1)])
  })

  it('week is Monday to Sunday', () => {
    const r = rangeFor('week', d(2026, 10, 21))
    expect(r.start).toEqual(d(2026, 10, 19))
    expect(r.end).toEqual(d(2026, 10, 26))
    expect(r.days).toHaveLength(7)
  })

  it('month fills whole Monday-first weeks (5 rows)', () => {
    const r = rangeFor('month', d(2026, 10, 19))
    expect(r.start).toEqual(d(2026, 9, 28))
    expect(r.end).toEqual(d(2026, 11, 2))
    expect(r.days).toHaveLength(35)
  })

  it('month starting on a Sunday: Feb 2026 is 5 rows (26 Jan to 1 Mar)', () => {
    const r = rangeFor('month', d(2026, 2, 10))
    expect(r.start).toEqual(d(2026, 1, 26))
    expect(r.end).toEqual(d(2026, 3, 2))
    expect(r.days).toHaveLength(35)
  })

  it('31-day month starting on a Sunday: Mar 2026 is 6 rows (23 Feb to 5 Apr)', () => {
    const r = rangeFor('month', d(2026, 3, 10))
    expect(r.start).toEqual(d(2026, 2, 23))
    expect(r.end).toEqual(d(2026, 4, 6))
    expect(r.days).toHaveLength(42)
    expect(r.days[41]).toEqual(d(2026, 4, 5))
  })

  it('schedule is date..+30 (30 days)', () => {
    const r = rangeFor('schedule', d(2026, 10, 19))
    expect(r.start).toEqual(d(2026, 10, 19))
    expect(r.end).toEqual(d(2026, 11, 18))
    expect(r.days).toHaveLength(30)
  })
})

describe('step', () => {
  it('moves day, 3day, week, schedule', () => {
    expect(step('day', d(2026, 10, 19), 1)).toEqual(d(2026, 10, 20))
    expect(step('3day', d(2026, 10, 19), -1)).toEqual(d(2026, 10, 16))
    expect(step('week', d(2026, 10, 19), 1)).toEqual(d(2026, 10, 26))
    expect(step('schedule', d(2026, 10, 19), -1)).toEqual(d(2026, 9, 19))
  })

  it('month from Jan 31 lands on Feb 1, and back on the 1st', () => {
    expect(step('month', d(2026, 1, 31), 1)).toEqual(d(2026, 2, 1))
    expect(step('month', d(2026, 3, 31), -1)).toEqual(d(2026, 2, 1))
    expect(step('month', d(2026, 12, 15), 1)).toEqual(d(2027, 1, 1))
  })
})

describe('titleFor', () => {
  it('month and same-month weeks', () => {
    expect(titleFor('month', d(2026, 10, 19), 'en-US')).toBe('October 2026')
    expect(titleFor('week', d(2026, 10, 19), 'en-US')).toBe('October 2026')
  })

  it('spanning months', () => {
    expect(titleFor('week', d(2026, 10, 28), 'en-US')).toBe('Oct – Nov 2026')
    expect(titleFor('3day', d(2026, 10, 30), 'en-US')).toBe('Oct – Nov 2026')
  })

  it('spanning years', () => {
    expect(titleFor('week', d(2026, 12, 30), 'en-US')).toBe('Dec 2026 – Jan 2027')
  })

  it('day view and schedule', () => {
    expect(titleFor('day', d(2026, 10, 19), 'en-US')).toBe('October 19, 2026')
    expect(titleFor('schedule', d(2026, 10, 19), 'en-US')).toBe('Oct – Nov 2026')
  })
})

describe('view params', () => {
  it('falls back on bad input', () => {
    const r = parseViewParams(new URLSearchParams('view=nope&date=2026-13-45'), 'week')
    expect(r.view).toBe('week')
    expect(isSameDay(r.date, new Date())).toBe(true)
    const s = parseViewParams(new URLSearchParams('date=abc'), 'day')
    expect(s.view).toBe('day')
    expect(isSameDay(s.date, new Date())).toBe(true)
    expect(isSameDay(parseViewParams(new URLSearchParams('date=2026-02-30'), 'day').date, new Date())).toBe(true)
  })

  it('parses the date as local', () => {
    const r = parseViewParams(new URLSearchParams('view=month&date=2026-10-19'), 'week')
    expect(r.view).toBe('month')
    expect(r.date).toEqual(d(2026, 10, 19))
  })

  it('round trips', () => {
    const params = toViewParams('3day', new Date(2026, 0, 5, 14))
    expect(params.toString()).toBe('view=3day&date=2026-01-05')
    expect(parseViewParams(params, 'week')).toEqual({ view: '3day', date: d(2026, 1, 5) })
  })
})

describe('monthGrid', () => {
  it('has 5 or 6 Monday-first rows of 7', () => {
    const oct = monthGrid(d(2026, 10, 19))
    expect(oct).toHaveLength(5)
    expect(oct[0][0]).toEqual(d(2026, 9, 28))
    const mar = monthGrid(d(2026, 3, 1))
    expect(mar).toHaveLength(6)
    expect(mar.every((row) => row.length === 7)).toBe(true)
  })
})

describe('VIEWS', () => {
  it('lists five views with shortcuts', () => {
    expect(VIEWS.map((v) => v.key)).toEqual(['d', 'x', 'w', 'm', 'a'])
  })
})
