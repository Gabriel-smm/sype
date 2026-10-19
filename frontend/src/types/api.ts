// Response and request shapes of the FastAPI backend, mirrored by hand from
// backend/app/schemas.py. Datetimes arrive as naive local ISO strings.

export type TaskStatus = 'pending' | 'done' | 'skipped'
export const COLOR_KEYS = [
  'rose', 'peach', 'butter', 'pistachio', 'mint', 'aqua', 'sky', 'periwinkle', 'lilac', 'blush', 'stone',
] as const
export type ColorKey = (typeof COLOR_KEYS)[number]

export interface Block {
  id: number
  label: string
  day_of_week: number | null
  start_time: string
  end_time: string
}

export type ProductiveWindow = Block

export type BlockInput = Omit<Block, 'id'>

export interface Weights {
  w_urgency: number
  w_grade: number
  w_stress: number
  w_effort_gap: number
}

export interface RecurringTaskInput {
  title: string
  task_type: string
  estimated_duration: number
  grade_weight: number
  stress_rating: number
  weekdays: number[]
  due_time: string
  category_id?: number | null
}

export interface RecurringTask extends RecurringTaskInput {
  id: number
  student_id: number
  active: boolean
}

export interface Settings {
  student: { id: number; name: string }
  productive_hours: ProductiveWindow[]
  recurring_tasks: RecurringTask[]
  weights: Weights & { student_id: number }
}

export interface Subtask {
  id: number
  parent_task_id: number
  title: string
  due_by: string
  estimated_duration: number
  time_invested: number
  phase: string
  requires_focus: boolean
  order_index: number
  status: TaskStatus
}

export interface TaskInput {
  title: string
  due_date: string
  estimated_duration: number
  task_type: string
  grade_weight: number
  stress_rating: number
  time_invested?: number
  category_id?: number | null
  color_key?: ColorKey | null
}

export interface Task extends Required<Omit<TaskInput, 'category_id' | 'color_key'>> {
  category_id: number | null
  color_key: ColorKey | null
  id: number
  student_id: number
  status: TaskStatus
  recurring_task_id: number | null
  subtasks: Subtask[]
}

export type TaskChanges = Partial<TaskInput> & { status?: TaskStatus }

export interface ScheduleSlot {
  id: number
  task_id: number | null
  subtask_id: number | null
  title: string
  parent_title: string | null
  task_type: string
  start_time: string
  end_time: string
  in_productive_hours: boolean
  requires_focus: boolean
  recurring: boolean
  priority_score: number
  due_date: string
  overdue: boolean
  category_id: number | null
  color_key: ColorKey | null
}

export interface UnschedulableItem {
  task_id: number | null
  subtask_id: number | null
  title: string
  priority_score: number
  estimated_duration: number
  due_date: string
  reason: string
}

export interface Schedule {
  horizon_start?: string
  horizon_end?: string
  generated_at?: string
  slots: ScheduleSlot[]
  unschedulable: UnschedulableItem[]
}

export interface RankedItem {
  task_id: number | null
  subtask_id: number | null
  title: string
  parent_title: string | null
  task_type: string
  priority_score: number
  due_date: string
}

export interface WeightsPreview {
  ranked: RankedItem[]
  total_pending: number
}

export interface ActivityEvent {
  id: number
  student_id: number
  task_id: number | null
  subtask_id: number | null
  event_type: string
  timestamp: string
  details: string
}

export interface Meta {
  task_types: string[]
  colors: ColorKey[]
  event_types: string[]
  default_student_id: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatProvider {
  name: string
  live: boolean
  detail: string
}

export interface Calendar {
  id: number
  name: string
  source: string
  is_primary: boolean
  visible: boolean
  color_key: ColorKey
  position: number
}

export interface CalendarInput {
  name: string
  color_key?: ColorKey
}

export type CalendarChanges = Partial<CalendarInput> & { visible?: boolean; position?: number }

export interface Category {
  id: number
  name: string
  color_key: ColorKey
  position: number
}

export type CategoryInput = { name: string; color_key: ColorKey }
export type CategoryChanges = Partial<CategoryInput> & { position?: number }

export type EventKind = 'default' | 'routine'

export interface CalendarEventInput {
  calendar_id?: number | null
  title: string
  description?: string
  location?: string
  start: string
  end: string
  all_day?: boolean
  busy?: boolean | null
  kind?: EventKind
  category_id?: number | null
  color_key?: ColorKey | null
  recurrence?: string[]
}

export type CalendarEventChanges = Partial<CalendarEventInput>

export interface CalendarEvent {
  id: number
  calendar_id: number
  category_id: number | null
  color_key: ColorKey | null
  title: string
  description: string
  location: string
  start: string
  end: string
  all_day: boolean
  busy: boolean
  kind: EventKind
  status: 'confirmed' | 'cancelled'
  recurrence: string[]
  recurring_event_id: number | null
  original_start_time: string | null
}

export interface Occurrence {
  id: string
  event_id: number
  calendar_id: number
  category_id: number | null
  color_key: ColorKey
  title: string
  description: string
  location: string
  start: string
  end: string
  all_day: boolean
  busy: boolean
  kind: EventKind
  recurring: boolean
  original_start: string | null
}
