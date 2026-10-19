// Pure maths behind calendar drag gestures and the all-day strip. All day
// arithmetic is wall-clock (local fields), because the grid is a fixed 24h clock
// even on days a DST change makes shorter or longer.
import { addDays, differenceInMinutes } from 'date-fns'

import type { Occurrence } from '@/types/api'
import { MINUTES_IN_DAY } from './time'

export const SNAP = 15
export const MIN_MINUTES = 15
export const CLICK_MINUTES = 60

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)

// Local wall-clock time `minute` minutes after midnight of `day` (1440 rolls to the next midnight).
function wallClock(day: Date, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute)
}

// Shift a date by whole days and wall-clock minutes (not absolute milliseconds).
function shiftWall(date: Date, dayDelta: number, minuteDelta: number): Date {
  return new Date(
    date.getFullYear(), date.getMonth(), date.getDate() + dayDelta,
    date.getHours(), date.getMinutes() + minuteDelta, date.getSeconds(),
  )
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
  }

  return { start: wallClock(day, low), end: wallClock(day, high) }
}

// Moves by whole days then wall-clock minutes, keeping the wall-clock duration.
export function applyMove(
  start: Date, end: Date, dayDelta: number, minuteDelta: number,
): { start: Date; end: Date } {
  return { start: shiftWall(start, dayDelta, minuteDelta), end: shiftWall(end, dayDelta, minuteDelta) }
}

// Only the end moves; the event never shrinks below the minimum.
export function applyResize(
  start: Date, end: Date, minuteDelta: number,
): { start: Date; end: Date } {
  const minEnd = shiftWall(start, 0, MIN_MINUTES)
  const next = shiftWall(end, 0, minuteDelta)
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
