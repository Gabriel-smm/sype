// Pure maths behind calendar drag gestures and the all-day strip. All day
// arithmetic goes through date-fns so DST changes keep wall-clock times.
import { addDays, addMinutes, differenceInMinutes } from 'date-fns'

import type { Occurrence } from '@/types/api'
import { MINUTES_IN_DAY } from './time'

export const SNAP = 15
export const MIN_MINUTES = 15
export const CLICK_MINUTES = 60

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)

function dayStart(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate())
}

// A pointer offset inside a day column, snapped to 15 minutes and kept on the day.
export function yToMinute(y: number, hourHeight: number): number {
  const minutes = Math.round(((y / hourHeight) * 60) / SNAP) * SNAP
  return clamp(minutes, 0, MINUTES_IN_DAY)
}

export function normaliseCreate(
  day: Date, fromMinute: number, toMinute: number,
): { start: Date; end: Date } {
  const from = clamp(fromMinute, 0, MINUTES_IN_DAY)
  const to = clamp(toMinute, 0, MINUTES_IN_DAY)
  let low: number
  let high: number

  if (Math.abs(to - from) < SNAP) {
    // A click (or a wobble): a default-length draft, shifted back if it would pass midnight.
    low = Math.min(from, MINUTES_IN_DAY - CLICK_MINUTES)
    high = low + CLICK_MINUTES
  } else {
    low = Math.min(from, to)
    high = Math.max(from, to)
    if (high - low < MIN_MINUTES) {
      high = Math.min(low + MIN_MINUTES, MINUTES_IN_DAY)
      low = high - MIN_MINUTES
    }
  }

  const base = dayStart(day)
  return { start: addMinutes(base, low), end: addMinutes(base, high) }
}

// Moves by whole days then minutes, preserving the duration exactly.
export function applyMove(
  start: Date, end: Date, dayDelta: number, minuteDelta: number,
): { start: Date; end: Date } {
  const duration = differenceInMinutes(end, start)
  const moved = addMinutes(addDays(start, dayDelta), minuteDelta)
  return { start: moved, end: addMinutes(moved, duration) }
}

// Only the end moves; the event never shrinks below the minimum.
export function applyResize(
  start: Date, end: Date, minuteDelta: number,
): { start: Date; end: Date } {
  const minEnd = addMinutes(start, MIN_MINUTES)
  const next = addMinutes(end, minuteDelta)
  return { start, end: next < minEnd ? minEnd : next }
}

export function isAllDayLike(o: Pick<Occurrence, 'all_day' | 'start' | 'end'>): boolean {
  if (o.all_day) return true
  return differenceInMinutes(new Date(o.end), new Date(o.start)) >= MINUTES_IN_DAY
}

export interface AllDayBar {
  occurrence: Occurrence
  firstDay: number
  span: number
  row: number
}

/**
 * Lay all-day-like occurrences out as bars over the visible days. Each bar
 * covers the visible days it touches (end exclusive) and sits in the lowest
 * row that is free across its whole span.
 */
export function allDayRows(occurrences: Occurrence[], days: Date[]): AllDayBar[] {
  const bars: Omit<AllDayBar, 'row'>[] = []

  occurrences.filter(isAllDayLike).forEach((occurrence) => {
    const start = new Date(occurrence.start)
    const end = new Date(occurrence.end)
    let firstDay = -1
    let lastDay = -1
    days.forEach((day, index) => {
      if (start < addDays(day, 1) && end > day) {
        if (firstDay === -1) firstDay = index
        lastDay = index
      }
    })
    if (firstDay === -1) return
    bars.push({ occurrence, firstDay, span: lastDay - firstDay + 1 })
  })

  bars.sort((a, b) => a.firstDay - b.firstDay || b.span - a.span)

  const rows: boolean[][] = []
  return bars.map((bar) => {
    let row = rows.findIndex((used) =>
      used.slice(bar.firstDay, bar.firstDay + bar.span).every((taken) => !taken))
    if (row === -1) {
      row = rows.length
      rows.push([])
    }
    for (let i = bar.firstDay; i < bar.firstDay + bar.span; i += 1) rows[row][i] = true
    return { ...bar, row }
  })
}
