// Response and request shapes of the FastAPI backend, mirrored by hand from
// backend/app/schemas.py. Datetimes arrive as naive local ISO strings.

export type TaskStatus = 'pending' | 'done' | 'skipped'
export type BlockKind = 'sleep' | 'lunch' | 'class' | 'other'

export interface Block {
  id: number
  label: string
  day_of_week: number | null
  start_time: string
  end_time: string
}

export interface FixedBlock extends Block {
  kind: BlockKind
}

export type ProductiveWindow = Block

export type BlockInput = Omit<Block, 'id'> & { kind?: BlockKind }

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
}

export interface RecurringTask extends RecurringTaskInput {
  id: number
  student_id: number
  active: boolean
}

export interface Settings {
  student: { id: number; name: string }
  fixed_blocks: FixedBlock[]
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
}

export interface Task extends Required<TaskInput> {
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
  block_kinds: string[]
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
