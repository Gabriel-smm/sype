// Thin wrapper over the FastAPI backend. Every call is scoped to one student;
// this MVP has no auth, so the id is fixed.
import type {
  ActivityEvent, BlockInput, ChatMessage, ChatProvider, FixedBlock, Meta, ProductiveWindow,
  RecurringTask, RecurringTaskInput, Schedule, Settings, Task, TaskChanges, TaskInput, Weights,
  WeightsPreview,
} from './types/api'

export const STUDENT_ID = 1

interface ValidationDetail {
  loc?: (string | number)[]
  msg: string
}

async function request<T = null>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const body = await response.text()
    let message = body
    try {
      const parsed = JSON.parse(body)
      message = Array.isArray(parsed.detail)
        ? (parsed.detail as ValidationDetail[]).map((d) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(', ')
        : parsed.detail || body
    } catch {
      /* keep the raw body */
    }
    throw new Error(message || `Request failed (${response.status})`)
  }
  return (response.status === 204 ? null : await response.json()) as T
}

const base = `/api/students/${STUDENT_ID}`

export const api = {
  meta: () => request<Meta>('/api/meta'),

  settings: () => request<Settings>(`${base}/settings`),
  saveWeights: (weights: Weights) =>
    request<Weights>(`${base}/weights`, { method: 'PUT', body: JSON.stringify(weights) }),
  previewWeights: (weights: Weights, limit = 5) =>
    request<WeightsPreview>(`${base}/weights/preview`, {
      method: 'POST',
      body: JSON.stringify({ ...weights, limit }),
    }),
  addFixedBlock: (block: BlockInput) =>
    request<FixedBlock>(`${base}/fixed-blocks`, { method: 'POST', body: JSON.stringify(block) }),
  deleteFixedBlock: (id: number) => request(`${base}/fixed-blocks/${id}`, { method: 'DELETE' }),
  addProductiveWindow: (window: BlockInput) =>
    request<ProductiveWindow>(`${base}/productive-hours`, { method: 'POST', body: JSON.stringify(window) }),
  deleteProductiveWindow: (id: number) =>
    request(`${base}/productive-hours/${id}`, { method: 'DELETE' }),

  tasks: () => request<Task[]>(`${base}/tasks`),
  createTask: (task: TaskInput) => request<Task>(`${base}/tasks`, { method: 'POST', body: JSON.stringify(task) }),
  updateTask: (id: number, changes: TaskChanges) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  deleteTask: (id: number) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  completeTask: (id: number) => request(`/api/tasks/${id}/complete`, { method: 'POST' }),
  skipTask: (id: number) => request(`/api/tasks/${id}/skip`, { method: 'POST' }),
  completeSubtask: (id: number) => request(`/api/subtasks/${id}/complete`, { method: 'POST' }),
  skipSubtask: (id: number) => request(`/api/subtasks/${id}/skip`, { method: 'POST' }),

  createRecurringTask: (task: RecurringTaskInput) =>
    request<RecurringTask>(`${base}/recurring-tasks`, { method: 'POST', body: JSON.stringify(task) }),
  updateRecurringTask: (id: number, changes: Partial<RecurringTaskInput> & { active?: boolean }) =>
    request<RecurringTask>(`/api/recurring-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  deleteRecurringTask: (id: number) => request(`/api/recurring-tasks/${id}`, { method: 'DELETE' }),

  schedule: () => request<Schedule>(`${base}/schedule`),
  generateSchedule: () => request<Schedule>(`${base}/schedule/generate`, { method: 'POST' }),
  moveSlot: (slotId: number, startTime: string, endTime: string) =>
    request<unknown>(`${base}/schedule/slots/${slotId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ start_time: startTime, end_time: endTime }),
    }),

  events: () => request<ActivityEvent[]>(`${base}/events`),

  chatProvider: () => request<ChatProvider>(`${base}/chat/provider`),
  chat: streamChat,
}

/**
 * Send a conversation and read the reply as it arrives.
 *
 * The backend emits server-sent events — `{type: "delta", text}` repeatedly,
 * then `{type: "done"}`, or `{type: "error", message}`. The shape is deliberately
 * independent of which model (if any) is behind it, so plugging in a real
 * provider changes nothing here.
 */
interface StreamOptions {
  onDelta?: (reply: string) => void
  signal?: AbortSignal
}

type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

async function streamChat(
  messages: ChatMessage[],
  { onDelta, signal }: StreamOptions = {},
): Promise<string> {
  const response = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(await response.text().catch(() => 'The chat service did not respond.'))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let reply = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Events are separated by a blank line; a partial one stays in the buffer.
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const line = chunk.split('\n').find((candidate) => candidate.startsWith('data: '))
      if (!line) continue

      const event = JSON.parse(line.slice('data: '.length)) as StreamEvent
      if (event.type === 'delta') {
        reply += event.text
        onDelta?.(reply)
      } else if (event.type === 'error') {
        throw new Error(event.message)
      }
    }
  }

  return reply
}

export { toApiDateTime } from './lib/time'
