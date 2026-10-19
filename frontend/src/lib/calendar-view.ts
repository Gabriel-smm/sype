// View and range logic for the calendar. Pure: no React, no DOM.
// Ranges are half-open [start, end) with start at local midnight.
import { addDays, addMonths, endOfMonth, startOfDay, startOfMonth } from 'date-fns'

import { weekStartOf } from '@/lib/time'

export type CalendarView = 'day' | '3day' | 'week' | 'month' | 'schedule'

export const VIEWS: { view: CalendarView; label: string; key: string }[] = [
  { view: 'day', label: 'Day', key: 'd' },
  { view: '3day', label: '3 days', key: 'x' },
  { view: 'week', label: 'Week', key: 'w' },
  { view: 'month', label: 'Month', key: 'm' },
  { view: 'schedule', label: 'Schedule', key: 'a' },
]

const SCHEDULE_DAYS = 30

function daysFrom(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, offset) => addDays(start, offset))
}

export function rangeFor(
  view: CalendarView,
  date: Date,
): { start: Date; end: Date; days: Date[] } {
  const day = startOfDay(date)
  let start: Date
  let count: number
  switch (view) {
    case 'day':
      start = day
      count = 1
      break
    case '3day':
      start = day
      count = 3
      break
    case 'week':
      start = weekStartOf(day)
      count = 7
      break
    case 'month': {
      start = weekStartOf(startOfMonth(day))
      const lastWeekStart = weekStartOf(endOfMonth(day))
      // Round to whole weeks: daylight-saving shifts make the ms difference off by an hour.
      count = Math.round((addDays(lastWeekStart, 7).getTime() - start.getTime()) / (7 * 86_400_000)) * 7
      break
    }
    case 'schedule':
      start = day
      count = SCHEDULE_DAYS
      break
  }
  return { start, end: addDays(start, count), days: daysFrom(start, count) }
}

export function step(view: CalendarView, date: Date, direction: 1 | -1): Date {
  const day = startOfDay(date)
  switch (view) {
    case 'day':
      return addDays(day, direction)
    case '3day':
      return addDays(day, 3 * direction)
    case 'week':
      return addDays(day, 7 * direction)
    case 'month':
      return startOfMonth(addMonths(startOfMonth(day), direction))
    case 'schedule':
      return addDays(day, SCHEDULE_DAYS * direction)
  }
}

export function titleFor(view: CalendarView, date: Date, locale?: string): string {
  const fmt = (value: Date, options: Intl.DateTimeFormatOptions) =>
    value.toLocaleDateString(locale, options)

  if (view === 'day') {
    return fmt(date, { month: 'long', day: 'numeric', year: 'numeric' })
  }
  if (view === 'month') {
    return fmt(date, { month: 'long', year: 'numeric' })
  }

  const { days } = rangeFor(view, date)
  const first = days[0]
  const last = days[days.length - 1]
  if (first.getFullYear() !== last.getFullYear()) {
    const part = (value: Date) => fmt(value, { month: 'short', year: 'numeric' })
    return `${part(first)} – ${part(last)}`
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${fmt(first, { month: 'short' })} – ${fmt(last, { month: 'short' })} ${first.getFullYear()}`
  }
  return fmt(first, { month: 'long', year: 'numeric' })
}

const DATE_PARAM = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDateParam(value: string | null): Date | null {
  const match = value ? DATE_PARAM.exec(value) : null
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const parsed = new Date(year, month - 1, day)
  const valid =
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  return valid ? parsed : null
}

export function parseViewParams(
  params: URLSearchParams,
  fallback: CalendarView,
): { view: CalendarView; date: Date } {
  const requested = params.get('view')
  const view = VIEWS.find((entry) => entry.view === requested)?.view ?? fallback
  return { view, date: parseDateParam(params.get('date')) ?? startOfDay(new Date()) }
}

export function toViewParams(view: CalendarView, date: Date): URLSearchParams {
  const pad = (n: number) => String(n).padStart(2, '0')
  return new URLSearchParams({
    view,
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
  })
}

export function monthGrid(date: Date): Date[][] {
  const { days } = rangeFor('month', date)
  return Array.from({ length: days.length / 7 }, (_, row) => days.slice(row * 7, row * 7 + 7))
}

const LATEST_DRAFT_MINUTE = 23 * 60

/**
 * Where a keyboard or Create-button event lands: the next half hour from `now`,
 * on the shown `date`, for 60 minutes. It starts by 23:00 so it ends that day.
 */
export function quickDraftFor(date: Date, now: Date): { start: Date; end: Date } {
  const minutes = Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30, LATEST_DRAFT_MINUTE)
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours() + 1, start.getMinutes())
  return { start, end }
}
