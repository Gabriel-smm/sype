// Vocabulary and colour. Hue identifies the kind of work; it is never decoration.

export const TYPE_LABELS = {
  essay_project: 'Essay or project',
  exam_study: 'Exam study',
  problem_set: 'Problem set',
  reading: 'Reading',
  admin: 'Admin',
  other: 'Other',
}

export const TYPE_COLORS = {
  essay_project: '#7c93e8',
  exam_study: '#c77dd4',
  problem_set: '#5fb3a3',
  reading: '#6fa8d6',
  admin: '#8a93a8',
  other: '#9e8cc4',
}

export const LAMP = '#e8b04b'
export const ALARM = '#e05a5a'

export function typeColor(taskType) {
  return TYPE_COLORS[taskType] ?? TYPE_COLORS.other
}

export function typeLabel(taskType) {
  return TYPE_LABELS[taskType] ?? taskType
}

export const BLOCK_KIND_LABELS = {
  sleep: 'Sleep',
  lunch: 'Meals',
  class: 'Class',
  other: 'Other',
}

// How close a deadline is, as a 0-1 ramp. Drives how deeply a due chip fills:
// the nearer the deadline, the more of it is coloured in.
export function urgency(dueDate, now = new Date()) {
  const days = (new Date(dueDate) - now) / 86400000
  if (days <= 0) return 1
  if (days >= 14) return 0
  return 1 - days / 14
}

export function dueBucket(dueDate, now = new Date()) {
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

export const BUCKET_HEADINGS = {
  overdue: 'Past due',
  today: 'Due today',
  week: 'This week',
  later: 'Later',
}

export function dueLabel(value, now = new Date()) {
  const due = new Date(value)
  const days = Math.round((due - now) / 86400000)
  const when = due.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  if (days < 0) return `${when}, ${Math.abs(days)}d late`
  if (days === 0) return `${when}, today`
  if (days === 1) return `${when}, tomorrow`
  return `${when}, in ${days}d`
}

// Shown live in the add-task form, so nobody is surprised by what appears on
// the calendar. Mirrors the rules in backend/app/decompose.py.
export function decompositionHint(taskType, hours) {
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
