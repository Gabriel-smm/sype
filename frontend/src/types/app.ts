// Contracts between the app shell and the pages it renders.
import type {
  BlockInput, RecurringTaskInput, Task, TaskChanges, TaskInput, Weights,
} from '@/types/api'

export type AddBlock = ((block: BlockInput) => Promise<unknown>) & { withKind?: boolean }

export interface Actions {
  createTask: (task: TaskInput) => Promise<Task>
  updateTask: (id: number, changes: TaskChanges) => Promise<unknown>
  completeTask: (id: number) => Promise<unknown>
  skipTask: (id: number) => Promise<unknown>
  deleteTask: (id: number) => Promise<unknown>
  completeSubtask: (id: number) => Promise<unknown>
  skipSubtask: (id: number) => Promise<unknown>
  saveWeights: (weights: Weights) => Promise<unknown>
  addFixedBlock: AddBlock
  deleteFixedBlock: (id: number) => Promise<unknown>
  addProductiveWindow: AddBlock
  deleteProductiveWindow: (id: number) => Promise<unknown>
  createRecurringTask: (task: RecurringTaskInput) => Promise<unknown>
  updateRecurringTask: (
    id: number,
    changes: Partial<RecurringTaskInput> & { active?: boolean },
  ) => Promise<unknown>
  deleteRecurringTask: (id: number) => Promise<unknown>
}

/** Done / Skip on a scheduled session; a session is a step when it has a subtask. */
export type SlotAction = (id: number, isSubtask: boolean) => Promise<unknown>

/** One-tap fixes for work that did not fit, shared by Today and Week. */
export interface Fixes {
  onPushDeadline: (taskId: number, days: number) => void
  onEdit: (taskId: number) => void
  onFocusHours: () => void
}

/** A route path, optionally with a section hash: `/setup#focus`. */
export type Navigate = (to: string) => void
