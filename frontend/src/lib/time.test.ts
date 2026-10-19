import { describe, expect, it } from 'vitest'

import type { Occurrence } from '@/types/api'
import { daysOfWeek, formatShortTime, formatTimeRange, layoutColumns, occurrenceSpans, projectRange } from './time'

// Monday 2026-09-14 is the week under test.
const weekStart = new Date(2026, 8, 14)
const week = daysOfWeek(weekStart)

const occurrence = (start: string, end: string, extra: Partial<Occurrence> = {}) => ({
  id: `${start}`, event_id: 1, calendar_id: 1, category_id: null, color_key: 'sky',
  title: 'Event', description: '', location: '', start, end, all_day: false, busy: true,
  kind: 'default', recurring: false, original_start: null, ...extra,
}) as Occurrence

describe('occurrenceSpans', () => {
  it('gives one span for a same-day event', () => {
    const spans = occurrenceSpans([occurrence('2026-09-14T09:00:00', '2026-09-14T10:15:00')], week)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({ dayOffset: 0, startMinute: 540, endMinute: 615 })
  })

  it('splits an overnight event at midnight', () => {
    const spans = occurrenceSpans([occurrence('2026-09-14T23:30:00', '2026-09-15T07:30:00')], week)
    expect(spans.map(({ dayOffset, startMinute, endMinute }) => ({ dayOffset, startMinute, endMinute })))
      .toEqual([
        { dayOffset: 0, startMinute: 1410, endMinute: 1440 },
        { dayOffset: 1, startMinute: 0, endMinute: 450 },
      ])
  })

  it('drops the part of a Sunday-night event that falls on the next Monday', () => {
    const spans = occurrenceSpans([occurrence('2026-09-20T23:00:00', '2026-09-21T07:00:00')], week)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({ dayOffset: 6, startMinute: 1380, endMinute: 1440 })
  })

  it('keeps the tail of an event that started before the week', () => {
    const spans = occurrenceSpans([occurrence('2026-09-13T23:00:00', '2026-09-14T07:00:00')], week)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({ dayOffset: 0, startMinute: 0, endMinute: 420 })
  })

  it('returns nothing for events outside the week', () => {
    const outside = [
      occurrence('2026-09-07T09:00:00', '2026-09-07T10:00:00'),
      occurrence('2026-09-21T09:00:00', '2026-09-21T10:00:00'),
    ]
    expect(occurrenceSpans(outside, week)).toEqual([])
  })

  it('treats an all-day event as one full-day span', () => {
    const spans = occurrenceSpans(
      [occurrence('2026-09-16T00:00:00', '2026-09-17T00:00:00', { all_day: true })], week)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({ dayOffset: 2, startMinute: 0, endMinute: 1440 })
  })
})

describe('occurrenceSpans over a short day list', () => {
  const overnight = occurrence('2026-09-14T23:30:00', '2026-09-15T07:30:00')

  it('keeps only the visible part in a single-day list', () => {
    const spans = occurrenceSpans([overnight], [new Date(2026, 8, 15)])
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({ dayOffset: 0, startMinute: 0, endMinute: 450 })
  })

  it('drops an all-day event that ends at midnight of the first visible day', () => {
    const before = occurrence('2026-09-14T00:00:00', '2026-09-16T00:00:00', { all_day: true })
    expect(occurrenceSpans([before], [new Date(2026, 8, 16), new Date(2026, 8, 17)])).toEqual([])
  })

  it('indexes dayOffset into the given days for a 3-day list', () => {
    const days = [new Date(2026, 8, 15), new Date(2026, 8, 16), new Date(2026, 8, 17)]
    const spans = occurrenceSpans(
      [overnight, occurrence('2026-09-17T08:00:00', '2026-09-17T09:00:00')], days)
    expect(spans.map((s) => [s.dayOffset, s.startMinute, s.endMinute])).toEqual([
      [0, 0, 450],
      [2, 480, 540],
    ])
  })
})

describe('layoutColumns', () => {
  it('puts two overlapping entries in two columns', () => {
    const placed = layoutColumns([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 570, endMinute: 630 },
    ])
    expect(placed.map((p) => [p.column, p.columns])).toEqual([[0, 2], [1, 2]])
  })

  it('keeps back-to-back entries in a single column', () => {
    const placed = layoutColumns([
      { startMinute: 540, endMinute: 600 },
      { startMinute: 600, endMinute: 660 },
    ])
    expect(placed.map((p) => p.columns)).toEqual([1, 1])
  })
})

describe('projectRange', () => {
  const threeDays = week.slice(1, 4) // Tue 15 – Thu 17

  it('clips a range to the visible days, one part per day', () => {
    expect(projectRange(new Date(2026, 8, 15, 23, 30), new Date(2026, 8, 16, 7, 30), threeDays)).toEqual([
      { dayOffset: 0, startMinute: 1410, endMinute: 1440 },
      { dayOffset: 1, startMinute: 0, endMinute: 450 },
    ])
  })

  it('drops parts outside the visible days', () => {
    expect(projectRange(new Date(2026, 8, 14, 22, 0), new Date(2026, 8, 15, 1, 0), threeDays)).toEqual([
      { dayOffset: 0, startMinute: 0, endMinute: 60 },
    ])
    expect(projectRange(new Date(2026, 8, 19, 9, 0), new Date(2026, 8, 19, 10, 0), threeDays)).toEqual([])
  })

  it('does not give an empty part to the day a range ends at midnight', () => {
    expect(projectRange(new Date(2026, 8, 15, 23, 0), new Date(2026, 8, 16, 0, 0), threeDays)).toEqual([
      { dayOffset: 0, startMinute: 1380, endMinute: 1440 },
    ])
  })
})

describe('formatShortTime / formatTimeRange', () => {
  it('prints an unpadded 24-hour clock', () => {
    expect(formatShortTime(new Date(2026, 8, 14, 9, 0))).toBe('9:00')
    expect(formatShortTime(new Date(2026, 8, 14, 0, 5))).toBe('0:05')
    expect(formatShortTime(new Date(2026, 8, 14, 17, 45))).toBe('17:45')
  })

  it('joins a range with an en dash', () => {
    expect(formatTimeRange(new Date(2026, 8, 14, 9, 0), new Date(2026, 8, 14, 10, 15))).toBe('9:00 – 10:15')
  })
})
