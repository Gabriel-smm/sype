// Week arithmetic shared by the calendar grid and the parameter page's week strip.
import { addDays, startOfWeek } from 'date-fns'

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const MINUTES_IN_DAY = 1440

export function weekStartOf(date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function daysOfWeek(date) {
  const start = weekStartOf(date)
  return Array.from({ length: 7 }, (_, offset) => addDays(start, offset))
}

// 0 = Monday, to match the API's day_of_week.
export function weekdayIndex(date) {
  return (date.getDay() + 6) % 7
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes()
}

export function parseHhmm(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function formatHhmm(totalMinutes) {
  const wrapped = ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`
}

export function formatClock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// "September 14 – 20, 2026", widening only as much as the dates require.
export function formatWeekRange(date) {
  const [first] = daysOfWeek(date)
  const last = addDays(first, 6)
  const month = (value) => value.toLocaleDateString([], { month: 'long' })

  if (first.getFullYear() !== last.getFullYear()) {
    return `${month(first)} ${first.getDate()}, ${first.getFullYear()} – ` +
      `${month(last)} ${last.getDate()}, ${last.getFullYear()}`
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${month(first)} ${first.getDate()} – ${month(last)} ${last.getDate()}, ${last.getFullYear()}`
  }
  return `${month(first)} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`
}

export function hoursLabel(minutes) {
  const hours = minutes / 60
  if (hours < 1) return `${Math.round(minutes)} min`
  return `${Math.round(hours * 10) / 10}h`
}

// The API takes naive local ISO strings; keep the conversion in one place.
export function toApiDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  )
}

export function toLocalInputValue(date) {
  return toApiDateTime(date).slice(0, 16)
}

/**
 * Project weekly-recurring blocks onto the seven days actually on screen, so
 * the student sees the constraints the scheduler used.
 *
 * A block whose end time is at or before its start runs overnight (sleep). Such
 * a block is split at midnight into a tail on its own day and a head on the
 * next, because a band cannot be drawn across two columns.
 */
export function expandRecurring(blocks, weekStart, kind) {
  const spans = []

  for (let offset = 0; offset < 7; offset += 1) {
    const day = addDays(weekStart, offset)
    const weekday = weekdayIndex(day)

    blocks.forEach((block) => {
      if (block.day_of_week !== null && block.day_of_week !== weekday) return

      const start = parseHhmm(block.start_time)
      const end = parseHhmm(block.end_time)
      const base = { kind, block, label: block.label || block.kind || labelFor(kind) }

      if (end <= start) {
        if (start < MINUTES_IN_DAY) {
          spans.push({ ...base, id: `${kind}-${block.id}-${offset}-tail`, dayOffset: offset,
            startMinute: start, endMinute: MINUTES_IN_DAY, overnight: true })
        }
        if (end > 0) {
          // These blocks recur every week, so the band that spills off Sunday
          // night is the same one that covers Monday morning. Wrap it round.
          spans.push({ ...base, id: `${kind}-${block.id}-${offset}-head`, dayOffset: (offset + 1) % 7,
            startMinute: 0, endMinute: end, overnight: true })
        }
      } else {
        spans.push({ ...base, id: `${kind}-${block.id}-${offset}`, dayOffset: offset,
          startMinute: start, endMinute: end, overnight: false })
      }
    })
  }

  return spans
}

function labelFor(kind) {
  return kind === 'productive' ? 'Focus time' : 'Busy'
}

/**
 * Lay overlapping items side by side, the way a week calendar does: walk them in
 * start order, drop each into the first column whose last item has already
 * ended, and give every item in a cluster the same width.
 */
export function layoutColumns(items) {
  const sorted = [...items].sort(
    (a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute,
  )

  const placed = []
  let cluster = []
  let columnEnds = []

  const flush = () => {
    cluster.forEach((entry) => {
      placed.push({ ...entry.item, column: entry.column, columns: columnEnds.length })
    })
    cluster = []
    columnEnds = []
  }

  sorted.forEach((item) => {
    if (columnEnds.length && columnEnds.every((end) => end <= item.startMinute)) flush()

    let column = columnEnds.findIndex((end) => end <= item.startMinute)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(item.endMinute)
    } else {
      columnEnds[column] = item.endMinute
    }
    cluster.push({ item, column })
  })

  flush()
  return placed
}
