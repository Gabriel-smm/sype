// Thin wrapper over the FastAPI backend. Every call is scoped to one student;
// this MVP has no auth, so the id is fixed.
export const STUDENT_ID = 1

async function request(path, options = {}) {
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
        ? parsed.detail.map((d) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(', ')
        : parsed.detail || body
    } catch {
      /* keep the raw body */
    }
    throw new Error(message || `Request failed (${response.status})`)
  }
  return response.status === 204 ? null : response.json()
}

const base = `/api/students/${STUDENT_ID}`

export const api = {
  meta: () => request('/api/meta'),

  settings: () => request(`${base}/settings`),
  saveWeights: (weights) =>
    request(`${base}/weights`, { method: 'PUT', body: JSON.stringify(weights) }),
  previewWeights: (weights, limit = 5) =>
    request(`${base}/weights/preview`, {
      method: 'POST',
      body: JSON.stringify({ ...weights, limit }),
    }),
  addFixedBlock: (block) =>
    request(`${base}/fixed-blocks`, { method: 'POST', body: JSON.stringify(block) }),
  deleteFixedBlock: (id) => request(`${base}/fixed-blocks/${id}`, { method: 'DELETE' }),
  addProductiveWindow: (window) =>
    request(`${base}/productive-hours`, { method: 'POST', body: JSON.stringify(window) }),
  deleteProductiveWindow: (id) =>
    request(`${base}/productive-hours/${id}`, { method: 'DELETE' }),

  tasks: () => request(`${base}/tasks`),
  createTask: (task) => request(`${base}/tasks`, { method: 'POST', body: JSON.stringify(task) }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  completeTask: (id) => request(`/api/tasks/${id}/complete`, { method: 'POST' }),
  skipTask: (id) => request(`/api/tasks/${id}/skip`, { method: 'POST' }),
  completeSubtask: (id) => request(`/api/subtasks/${id}/complete`, { method: 'POST' }),
  skipSubtask: (id) => request(`/api/subtasks/${id}/skip`, { method: 'POST' }),

  schedule: () => request(`${base}/schedule`),
  generateSchedule: () => request(`${base}/schedule/generate`, { method: 'POST' }),
  moveSlot: (slotId, startTime, endTime) =>
    request(`${base}/schedule/slots/${slotId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ start_time: startTime, end_time: endTime }),
    }),

  events: () => request(`${base}/events`),

  chatProvider: () => request(`${base}/chat/provider`),
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
async function streamChat(messages, { onDelta, signal } = {}) {
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

      const event = JSON.parse(line.slice('data: '.length))
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
