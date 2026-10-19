import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import { newThread, parseStored, serialize, withMessages, type Thread, type ThreadState } from '@/lib/chat-threads'
import { errorMessage } from '@/lib/utils'
import type { ChatMessage, ChatProvider } from '@/types/api'

const STORAGE_KEY = 'sype.chat.v1'

function load(): ThreadState {
  try {
    return parseStored(localStorage.getItem(STORAGE_KEY))
  } catch {
    return { threads: [], activeId: null }
  }
}

/**
 * Saved conversations, shared by the Chat page and the chat drawer, so the
 * thread you start in one carries on in the other. Kept in the browser:
 * `activeId` null is a fresh chat that is only saved once it has a message.
 */
export function useChat() {
  const [state, setState] = useState<ThreadState>(load)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [provider, setProvider] = useState<ChatProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { threads, activeId } = state
  const active = threads.find((thread) => thread.id === activeId) ?? null

  useEffect(() => {
    api.chatProvider().then(setProvider).catch(() => setProvider(null))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serialize(state))
    } catch {
      // Private windows and full storage: the chat still works, it just isn't kept.
    }
  }, [state])

  const update = (id: string, messages: ChatMessage[]) =>
    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) => (thread.id === id ? withMessages(thread, messages) : thread)),
    }))

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streamingId) return

    // The id is fixed here, so the reply lands in this thread even if the student switches away.
    const thread: Thread = active ?? newThread()
    const history: ChatMessage[] = [...thread.messages, { role: 'user', content: trimmed }]
    setState((current) => ({
      activeId: thread.id,
      threads: active
        ? current.threads.map((t) => (t.id === thread.id ? withMessages(t, [...history, { role: 'assistant', content: '' }]) : t))
        : [withMessages(thread, [...history, { role: 'assistant', content: '' }]), ...current.threads],
    }))
    setStreamingId(thread.id)
    setError(null)

    try {
      await api.chat(history, {
        onDelta: (reply) => update(thread.id, [...history, { role: 'assistant', content: reply }]),
      })
    } catch (err) {
      setError(errorMessage(err))
      update(thread.id, history)
    } finally {
      setStreamingId(null)
    }
  }, [active, streamingId])

  const newChat = useCallback(() => {
    setError(null)
    setState((current) => ({ ...current, activeId: null }))
  }, [])

  const select = useCallback((id: string) => {
    setError(null)
    setState((current) => ({ ...current, activeId: id }))
  }, [])

  const remove = useCallback((id: string) => {
    setState((current) => ({
      threads: current.threads.filter((thread) => thread.id !== id),
      activeId: current.activeId === id ? null : current.activeId,
    }))
  }, [])

  const rename = useCallback((id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) => (thread.id === id ? { ...thread, title: trimmed } : thread)),
    }))
  }, [])

  return {
    threads,
    active,
    messages: active?.messages ?? [],
    /** The active thread is the one receiving a reply right now. */
    streaming: streamingId !== null && streamingId === activeId,
    /** Some thread is receiving a reply, so sending is paused everywhere. */
    busy: streamingId !== null,
    provider,
    error,
    send,
    newChat,
    select,
    remove,
    rename,
  }
}

export type Chat = ReturnType<typeof useChat>
