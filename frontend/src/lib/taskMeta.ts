// Vocabulary and colour. Hue identifies the kind of work; it is never decoration.

export const TYPE_LABELS: Record<string, string> = {
  essay_project: 'Essay or project',
  exam_study: 'Exam study',
  problem_set: 'Problem set',
  reading: 'Reading',
  admin: 'Admin',
  other: 'Other',
  routine: 'Routine',
}

export const TYPE_COLORS: Record<string, string> = {
  essay_project: '#7c93e8',
  exam_study: '#c77dd4',
  problem_set: '#5fb3a3',
  reading: '#6fa8d6',
  admin: '#8a93a8',
  other: '#9e8cc4',
  routine: '#e0a05a',
}

export const LAMP = '#e8b04b'
export const ALARM = '#e05a5a'

export function typeColor(taskType: string): string {
  return TYPE_COLORS[taskType] ?? TYPE_COLORS.other
}

export function typeLabel(taskType: string): string {
  return TYPE_LABELS[taskType] ?? taskType
}

export const BLOCK_KIND_LABELS: Record<string, string> = {
  sleep: 'Sleep',
  lunch: 'Meals',
  class: 'Class',
  other: 'Other',
}

// How close a deadline is, as a 0-1 ramp. Drives how deeply a due chip fills:
// the nearer the deadline, the more of it is coloured in.
export function urgency(dueDate: string, now = new Date()): number {
  const days = (new Date(dueDate).getTime() - now.getTime()) / 86400000
  if (days <= 0) return 1
  if (days >= 14) return 0
  return 1 - days / 14
}

export type DueBucket = 'overdue' | 'today' | 'week' | 'later'

export function dueBucket(dueDate: string, now = new Date()): DueBucket {
  const due = new Date(dueDate)
  if (due < now) return 'overdue'
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  if (due <= endOfToday) return 'today'
  const endOfWeek = new Date(endOfToday)
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  if (due <= endOfWeek) return 'week'
  return 'later'
}

export const BUCKET_HEADINGS: Record<DueBucket, string> = {
  overdue: 'Past due',
  today: 'Due today',
  week: 'This week',
  later: 'Later',
}

export function dueLabel(value: string, now = new Date()): string {
  const due = new Date(value)
  const days = Math.round((due.getTime() - now.getTime()) / 86400000)
  const when = due.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  if (days < 0) return `${when}, ${Math.abs(days)}d late`
  if (days === 0) return `${when}, today`
  if (days === 1) return `${when}, tomorrow`
  return `${when}, in ${days}d`
}

// Shown live in the add-task form, so nobody is surprised by what appears on
// the calendar. Mirrors the rules in backend/app/decompose.py.
export function decompositionHint(taskType: string, hours: number): string {
  if (taskType === 'exam_study') {
    return 'Splits into spaced study sessions 10, 6, 3 and 1 days before the exam.'
  }
  if (taskType === 'essay_project') {
    return hours > 3
      ? 'Splits into research, outline, draft and revise.'
      : 'Under three hours, so it stays one block.'
  }
  return 'Scheduled as a single block.'
}
