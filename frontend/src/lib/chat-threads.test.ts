import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '@/types/api'
import {
  NEW_CHAT_TITLE, groupByDay, newThread, parseStored, serialize, titleFrom, withMessages, type Thread,
} from './chat-threads'

// Wednesday 23 September 2026, 14:30 local.
const NOW = new Date(2026, 8, 23, 14, 30)
const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).getTime()

const user = (content: string): ChatMessage => ({ role: 'user', content })
const reply = (content: string): ChatMessage => ({ role: 'assistant', content })
const thread = (id: string, updatedAt: number, messages: ChatMessage[] = [user('hi')]): Thread =>
  ({ id, title: id, createdAt: updatedAt, updatedAt, messages })

describe('newThread', () => {
  it('starts empty, titled as a new chat', () => {
    expect(newThread(at(23), 'a')).toEqual({ id: 'a', title: NEW_CHAT_TITLE, createdAt: at(23), updatedAt: at(23), messages: [] })
  })

  it('gives each thread its own id', () => {
    expect(newThread().id).not.toBe(newThread().id)
  })
})

describe('titleFrom', () => {
  it('uses the first line, with spacing tidied', () => {
    expect(titleFrom('  Plan my   week\nwith a gym day')).toBe('Plan my week')
  })

  it('cuts long text at a word and marks the cut', () => {
    const title = titleFrom('Add my ethics paper due Friday worth thirty percent and split it into steps')
    expect(title).toBe('Add my ethics paper due Friday worth thirty…')
    expect(title.length).toBeLessThanOrEqual(48)
  })

  it('falls back to the new chat title for blank text', () => {
    expect(titleFrom('   \n ')).toBe(NEW_CHAT_TITLE)
  })
})

describe('withMessages', () => {
  it('names a new chat after its first question and stamps the time', () => {
    const next = withMessages(newThread(at(22), 'a'), [user('What is due this week?'), reply('')], at(23))
    expect(next.title).toBe('What is due this week?')
    expect(next.updatedAt).toBe(at(23))
    expect(next.messages).toHaveLength(2)
  })

  it('keeps a title the student chose', () => {
    const named = { ...newThread(at(22), 'a'), title: 'Bio revision' }
    expect(withMessages(named, [user('Quiz me')], at(23)).title).toBe('Bio revision')
  })
})

describe('groupByDay', () => {
  it('sorts newest first into today, yesterday and earlier, leaving out empty groups', () => {
    const groups = groupByDay([thread('old', at(10)), thread('today', at(23, 9)), thread('later', at(23, 13))], NOW)
    expect(groups.map((g) => [g.label, g.threads.map((t) => t.id)])).toEqual([
      ['Today', ['later', 'today']],
      ['Earlier', ['old']],
    ])
  })

  it('puts the day before in yesterday', () => {
    expect(groupByDay([thread('y', at(22, 23))], NOW)[0].label).toBe('Yesterday')
  })
})

describe('serialize and parseStored', () => {
  it('round-trips threads and the active one', () => {
    const state = { threads: [thread('a', at(23))], activeId: 'a' }
    expect(parseStored(serialize(state))).toEqual(state)
  })

  it('does not save chats with no messages', () => {
    const state = { threads: [thread('a', at(23)), thread('empty', at(23), [])], activeId: 'empty' }
    expect(parseStored(serialize(state))).toEqual({ threads: [thread('a', at(23))], activeId: null })
  })

  it('starts fresh on missing or broken storage', () => {
    expect(parseStored(null)).toEqual({ threads: [], activeId: null })
    expect(parseStored('{not json')).toEqual({ threads: [], activeId: null })
    expect(parseStored('{"threads": 3}')).toEqual({ threads: [], activeId: null })
  })

  it('drops threads that do not have the expected shape', () => {
    const raw = JSON.stringify({
      threads: [
        thread('good', at(23)),
        { id: 'bad', title: 'x', createdAt: 1, updatedAt: 1, messages: [{ role: 'system', content: 'x' }] },
        { id: 7 },
      ],
      activeId: 'bad',
    })
    expect(parseStored(raw)).toEqual({ threads: [thread('good', at(23))], activeId: null })
  })
})
