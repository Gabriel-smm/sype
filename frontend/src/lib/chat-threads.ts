// Saved chat conversations. They live in the browser only: the backend is
// stateless and takes the whole history with every message. Pure functions so
// naming, grouping and the storage format are testable.

import type { ChatMessage } from '@/types/api'
import { isSameDay } from './time'

export const NEW_CHAT_TITLE = 'New chat'
const TITLE_LENGTH = 48

export interface Thread {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

export interface ThreadState {
  threads: Thread[]
  activeId: string | null
}

// randomUUID needs a secure context, which a phone on the LAN does not have.
const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

export function newThread(now = Date.now(), id = makeId()): Thread {
  return { id, title: NEW_CHAT_TITLE, createdAt: now, updatedAt: now, messages: [] }
}

/** A short name from the first line of a message, cut at a word. */
export function titleFrom(text: string): string {
  const line = text.split('\n').map((part) => part.replace(/\s+/g, ' ').trim()).find(Boolean)
  if (!line) return NEW_CHAT_TITLE
  if (line.length <= TITLE_LENGTH) return line
  const cut = line.slice(0, TITLE_LENGTH - 1)
  const space = cut.lastIndexOf(' ')
  return `${space > 0 ? cut.slice(0, space) : cut}…`
}

/** Replace a thread's messages. A new chat takes its name from the first question. */
export function withMessages(thread: Thread, messages: ChatMessage[], now = Date.now()): Thread {
  const first = messages.find((message) => message.role === 'user')
  const title = thread.title === NEW_CHAT_TITLE && first ? titleFrom(first.content) : thread.title
  return { ...thread, title, messages, updatedAt: now }
}

export interface ThreadGroup {
  label: 'Today' | 'Yesterday' | 'Earlier'
  threads: Thread[]
}

/** Newest first, bucketed the way chat apps list history. Empty buckets are left out. */
export function groupByDay(threads: Thread[], now = new Date()): ThreadGroup[] {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const groups: ThreadGroup[] = [
    { label: 'Today', threads: [] },
    { label: 'Yesterday', threads: [] },
    { label: 'Earlier', threads: [] },
  ]
  for (const thread of [...threads].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const day = new Date(thread.updatedAt)
    const index = isSameDay(day, now) ? 0 : isSameDay(day, yesterday) ? 1 : 2
    groups[index].threads.push(thread)
  }
  return groups.filter((group) => group.threads.length > 0)
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// Example history for a first run, so the sidebar shows what saved chats look like.
const PLACEHOLDERS: { title: string; ago: number; messages: ChatMessage[] }[] = [
  {
    title: 'Plan my week before the chem midterm',
    ago: 1 * HOUR,
    messages: [
      { role: 'user', content: 'My chem midterm is Thursday. Can you plan my week around it?' },
      { role: 'assistant', content: 'Add the midterm as a task due Thursday and Sype will spread review sessions over Monday to Wednesday, heaviest the day before.' },
    ],
  },
  {
    title: "What's due Friday?",
    ago: 3 * HOUR,
    messages: [
      { role: 'user', content: "What's due Friday?" },
      { role: 'assistant', content: 'The calculus problem set and the lab report draft. Both are already in your calendar for Wednesday and Thursday afternoon.' },
    ],
  },
  {
    title: 'Split the history essay into steps',
    ago: 1 * DAY,
    messages: [
      { role: 'user', content: 'I have a 2,500 word history essay due in ten days. Break it up for me.' },
      { role: 'assistant', content: 'Research, outline, first draft and revision. Give the task 8 hours and Sype will split it into sessions before the deadline.' },
    ],
  },
  {
    title: 'Move gym to mornings',
    ago: 3 * DAY,
    messages: [
      { role: 'user', content: 'Can I move gym to the mornings?' },
      { role: 'assistant', content: 'Change your gym routine in Setup to 7:00–8:00 and rebuild the schedule. Study blocks will shift to the evenings you freed up.' },
    ],
  },
  {
    title: 'Add a reading block for Lit',
    ago: 6 * DAY,
    messages: [
      { role: 'user', content: 'I need to read two chapters for Lit every week.' },
      { role: 'assistant', content: 'Set it up as a weekly recurring task of about 2 hours and it will be placed in your focus hours each week.' },
    ],
  },
]

/** A handful of past chats spread over today, yesterday and earlier. */
export function placeholderThreads(now = Date.now()): Thread[] {
  return PLACEHOLDERS.map(({ title, ago, messages }, index) => ({
    id: `placeholder-${index}`, title, createdAt: now - ago, updatedAt: now - ago, messages,
  }))
}

/** Chats whose title contains every word of the query, ignoring case. An empty query keeps all. */
export function filterThreads(threads: Thread[], query: string): Thread[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return threads
  return threads.filter((thread) => {
    const title = thread.title.toLowerCase()
    return words.every((word) => title.includes(word))
  })
}

/** Chats with nothing in them are not worth keeping. */
export function serialize({ threads, activeId }: ThreadState): string {
  return JSON.stringify({ threads: threads.filter((thread) => thread.messages.length > 0), activeId })
}

const isMessage = (value: unknown): value is ChatMessage => {
  const message = value as ChatMessage
  return typeof message === 'object' && message !== null
    && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string'
}

const isThread = (value: unknown): value is Thread => {
  const thread = value as Thread
  return typeof thread === 'object' && thread !== null
    && typeof thread.id === 'string' && typeof thread.title === 'string'
    && typeof thread.createdAt === 'number' && typeof thread.updatedAt === 'number'
    && Array.isArray(thread.messages) && thread.messages.length > 0 && thread.messages.every(isMessage)
}

/** Read what serialize wrote, dropping anything malformed rather than failing. */
export function parseStored(raw: string | null): ThreadState {
  const empty: ThreadState = { threads: [], activeId: null }
  if (!raw) return empty
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return empty
  }
  const stored = data as Partial<ThreadState> | null
  if (!stored || !Array.isArray(stored.threads)) return empty
  const threads = stored.threads.filter(isThread)
  const activeId = threads.some((thread) => thread.id === stored.activeId) ? stored.activeId ?? null : null
  return { threads, activeId }
}
