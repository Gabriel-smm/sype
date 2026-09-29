// One line of text in, a task out. Deterministic on purpose: the same line on
// the same day always means the same task, and every guess is shown back as a
// chip the student can correct before saving.

import { toApiDateTime, weekdayIndex } from './time'

// How long a task probably takes when the line does not say.
export const DEFAULT_MINUTES: Record<string, number> = {
  essay_project: 360,
  exam_study: 240,
  problem_set: 120,
  reading: 60,
  admin: 30,
  other: 60,
  routine: 60,
}

// Words that name the kind of work. They stay in the title - "HIST essay" is
// still the essay's name - but they pick the type.
const TYPE_WORDS: [string, string[]][] = [
  ['essay_project', ['essay', 'essays', 'paper', 'project']],
  ['exam_study', ['exam', 'exams', 'midterm', 'final', 'finals', 'quiz', 'test']],
  ['problem_set', ['pset', 'psets', 'hw', 'homework', 'problem set']],
  ['reading', ['read', 'reading', 'chapter', 'ch']],
  ['admin', ['email', 'form', 'register', 'apply']],
]

const WEEKDAYS = [
  ['mon', 'monday'],
  ['tue', 'tues', 'tuesday'],
  ['wed', 'weds', 'wednesday'],
  ['thu', 'thur', 'thurs', 'thursday'],
  ['fri', 'friday'],
  ['sat', 'saturday'],
  ['sun', 'sunday'],
]

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

const END_OF_DAY = 23 * 60 + 59

function weekdayOf(word: string): number | null {
  const index = WEEKDAYS.findIndex((names) => names.includes(word))
  return index === -1 ? null : index
}

function monthOf(word: string): number | null {
  // "oct", "octo", "october" and "sept." all count; "marbles" does not.
  const bare = word.replace(/\.$/, '')
  if (bare.length < 3) return null
  const index = MONTHS.findIndex((name) => name.startsWith(bare))
  return index === -1 ? null : index
}

function dayOf(word: string): number | null {
  const match = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(word)
  if (!match) return null
  const day = Number(match[1])
  return day >= 1 && day <= 31 ? day : null
}

function parseDuration(word: string): number | null {
  let match = /^(\d+(?:\.\d+)?)(?:h|hr|hrs|hour|hours)(?:(\d{1,2})m?)?$/.exec(word)
  if (match) return Math.round(Number(match[1]) * 60 + Number(match[2] ?? 0))
  match = /^(\d+)(?:m|min|mins|minutes?)$/.exec(word)
  if (match) return Number(match[1])
  return null
}

// Minutes since midnight, or null.
function parseTime(word: string): number | null {
  if (word === 'noon') return 12 * 60
  if (word === 'midnight') return END_OF_DAY
  let match = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(word)
  if (match) {
    const hour = Number(match[1])
    if (hour < 1 || hour > 12) return null
    return ((hour % 12) + (match[3] === 'pm' ? 12 : 0)) * 60 + Number(match[2] ?? 0)
  }
  match = /^(\d{1,2}):(\d{2})$/.exec(word)
  if (match && Number(match[1]) < 24 && Number(match[2]) < 60) {
    return Number(match[1]) * 60 + Number(match[2])
  }
  return null
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function atMinutes(date: Date, minutes: number): Date {
  const next = new Date(date)
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return next
}

/**
 * Try to read a date starting at token `i`. Returns `{ length, resolve }`
 * where `resolve(time, now)` produces the Date, or null.
 */
type Resolve = (time: number, now: Date) => Date

interface DateMatch {
  length: number
  resolve: Resolve
}

function matchDate(words: string[], i: number): DateMatch | null {
  const word = words[i]
  const next = words[i + 1]

  if (word === 'today' || word === 'tonight') {
    return { length: 1, resolve: (time: number, now: Date) => atMinutes(now, time) }
  }
  if (['tomorrow', 'tmr', 'tmrw', 'tmw'].includes(word)) {
    return { length: 1, resolve: (time: number, now: Date) => atMinutes(addDays(now, 1), time) }
  }

  const nextWeekday = next == null ? null : weekdayOf(next)
  if (word === 'next' && nextWeekday != null) {
    const target = nextWeekday
    return {
      length: 2,
      // The named day in next calendar week.
      resolve: (time: number, now: Date) =>
        atMinutes(addDays(now, 7 - weekdayIndex(now) + target), time),
    }
  }

  const weekday = weekdayOf(word)
  if (weekday != null) {
    const target = weekday
    return {
      length: 1,
      resolve: (time: number, now: Date) => {
        const due = atMinutes(addDays(now, (target - weekdayIndex(now) + 7) % 7), time)
        // Today's own weekday only means today while there is time left.
        return due <= now ? addDays(due, 7) : due
      },
    }
  }

  if (word === 'in' && /^\d+$/.test(next ?? '') && /^days?$/.test(words[i + 2] ?? '')) {
    const days = Number(next)
    return { length: 3, resolve: (time: number, now: Date) => atMinutes(addDays(now, days), time) }
  }

  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(word)
  if (slash) {
    const month = Number(slash[1]) - 1
    const day = Number(slash[2])
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : null
    if (month > 11 || day < 1 || day > 31) return null
    return { length: 1, resolve: calendarDate(month, day, year) }
  }

  const month = monthOf(word)
  const nextDay = next == null ? null : dayOf(next)
  if (month != null && nextDay != null) {
    return { length: 2, resolve: calendarDate(month, nextDay, null) }
  }
  const day = dayOf(word)
  const nextMonth = next == null ? null : monthOf(next)
  if (day != null && nextMonth != null) {
    return { length: 2, resolve: calendarDate(nextMonth, day, null) }
  }

  return null
}

// A month and day with no year means the next time that date comes round.
function calendarDate(month: number, day: number, year: number | null): Resolve {
  return (time, now) => {
    const due = atMinutes(new Date(year ?? now.getFullYear(), month, day), time)
    if (year == null && atMinutes(due, END_OF_DAY) < now) due.setFullYear(due.getFullYear() + 1)
    return due
  }
}

function findType(words: string[]): [string, string] | null {
  for (let i = 0; i < words.length; i += 1) {
    const pair = `${words[i]} ${words[i + 1] ?? ''}`
    for (const [type, names] of TYPE_WORDS) {
      const hit = names.find((name) => name === words[i] || name === pair)
      if (hit) return [type, hit]
    }
  }
  return null
}

/**
 * Read a capture line such as "HIST essay fri 5pm 4h 20%".
 *
 * Returns the fields `POST /tasks` takes, plus `matched`: the text each field
 * was read from, so the form can show what was understood and what was
 * defaulted.
 */
export type CaptureField =
  | 'title' | 'due_date' | 'due_time' | 'estimated_duration' | 'task_type'
  | 'grade_weight' | 'stress_rating'

export interface ParsedCapture {
  title: string
  due_date: string
  estimated_duration: number
  task_type: string
  grade_weight: number
  stress_rating: number
  matched: Partial<Record<CaptureField, string>>
}

export function parseCapture(text: string, now = new Date()): ParsedCapture {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  const words = tokens.map((token) => token.toLowerCase())
  const used = new Array(tokens.length).fill(false)
  const matched: ParsedCapture['matched'] = {}
  const take = (field: CaptureField, start: number, length: number) => {
    for (let k = start; k < start + length; k += 1) used[k] = true
    matched[field] = tokens.slice(start, start + length).join(' ')
  }

  let estimated: number | null = null
  let grade: number | null = null
  let stress: number | null = null
  let time: number | null = null
  let date: DateMatch | null = null

  for (let i = 0; i < words.length; i += 1) {
    if (used[i]) continue
    const word = words[i]

    if (stress == null && /^!+$/.test(word)) {
      stress = word.length === 1 ? 4 : 5
      take('stress_rating', i, 1)
      continue
    }

    const percent = /^(\d+(?:\.\d+)?)%$/.exec(word)
    if (grade == null && percent) {
      grade = Math.min(Number(percent[1]), 100)
      take('grade_weight', i, 1)
      continue
    }

    const minutes = parseDuration(word)
    if (estimated == null && minutes != null && minutes > 0) {
      estimated = minutes
      take('estimated_duration', i, 1)
      continue
    }

    const clock = parseTime(word)
    if (time == null && clock != null) {
      time = clock
      take('due_time', i, 1)
      continue
    }

    const found: DateMatch | null = date == null ? matchDate(words, i) : null
    if (found) {
      date = found
      take('due_date', i, found.length)
      i += found.length - 1
    }
  }

  const titleWords = tokens.filter((_, i) => !used[i])
  const type = findType(titleWords.map((word) => word.toLowerCase().replace(/[^\w]/g, '')))
  if (type) matched.task_type = type[1]
  const taskType = type ? type[0] : 'other'

  let due: Date
  if (date) {
    due = date.resolve(time ?? END_OF_DAY, now)
  } else if (time != null) {
    due = atMinutes(now, time)
    if (due <= now) due = addDays(due, 1)
  } else {
    due = atMinutes(addDays(now, 7), END_OF_DAY)
  }

  return {
    title: titleWords.join(' '),
    due_date: toApiDateTime(due),
    estimated_duration: estimated ?? DEFAULT_MINUTES[taskType],
    task_type: taskType,
    grade_weight: grade ?? 0,
    stress_rating: stress ?? 3,
    matched,
  }
}
