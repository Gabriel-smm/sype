import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import { errorMessage } from '@/lib/utils'
import type { ChatMessage, ChatProvider } from '@/types/api'

/**
 * The conversation lives above the chat panel, so closing the panel and
 * opening it again keeps the thread.
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [provider, setProvider] = useState<ChatProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.chatProvider().then(setProvider).catch(() => setProvider(null))
  }, [])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const history: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)
    setError(null)

    try {
      await api.chat(history, {
        onDelta: (reply) => setMessages([...history, { role: 'assistant', content: reply }]),
      })
    } catch (err) {
      setError(errorMessage(err))
      setMessages(history)
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming])

  return { messages, streaming, provider, error, send }
}

export type Chat = ReturnType<typeof useChat>
