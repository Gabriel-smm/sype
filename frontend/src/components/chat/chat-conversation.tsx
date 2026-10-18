import { ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Markdown from 'react-markdown'

import type { Chat } from '@/hooks/use-chat'
import { cn } from '@/lib/utils'

const SUGGESTIONS = [
  'What’s on my schedule today?',
  'What’s due in the next two weeks?',
  'Add my ethics paper, due Friday, worth 30%',
  'Help me plan my week',
]

interface ChatConversationProps {
  chat: Chat
  /** `page` centres a reading column; `panel` fills a narrow side panel. */
  variant: 'page' | 'panel'
  inputId?: string
  autoFocus?: boolean
}

/**
 * One conversation: the messages and the composer. Questions sit in a quiet
 * bubble on the right; answers read as plain text, the way chat apps do.
 */
export function ChatConversation({ chat, variant, inputId, autoFocus = false }: ChatConversationProps) {
  const { messages, streaming, busy, provider, error, send, active } = chat
  const [input, setInput] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const page = variant === 'page'
  const column = page ? 'mx-auto w-full max-w-[44rem] px-5' : 'px-4'

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streaming])

  // A new or different thread starts with the cursor in the composer.
  useEffect(() => {
    if (autoFocus) composer.current?.focus()
  }, [autoFocus, active?.id])

  async function submit(text: string) {
    if (!text.trim() || busy) return
    setInput('')
    grow(composer.current, true)
    await send(text)
    composer.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit(input)
    }
  }

  const offline = provider && !provider.live

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto">
          {messages.length === 0 ? (
            <div className={cn(column, 'flex h-full flex-col justify-center pb-8')}>
              <h2 className={cn('font-semibold text-white', page ? 'text-xl' : 'text-[15px]')}>Ask about your week</h2>
              <p className="mt-1 text-[13px] text-white/50">
                It reads and updates your tasks. The scheduler still decides where work lands.
              </p>
              <ul className={cn('mt-5 grid gap-2', page && 'sm:grid-cols-2')}>
                {SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => void submit(suggestion)}
                      disabled={busy}
                      className="w-full rounded-lg border border-white/10 px-3 py-2 text-left text-[13px] text-white/60
                                 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className={cn(column, 'flex flex-col gap-5 py-5')}>
              {messages.map((message, index) => {
                const user = message.role === 'user'
                const last = index === messages.length - 1
                return (
                  <li key={index} className={cn('flex', user ? 'justify-end' : 'justify-start')}>
                    {user ? (
                      <p className="max-w-[85%] rounded-2xl bg-white/[0.08] px-4 py-2 text-[15px] leading-relaxed whitespace-pre-wrap
                                    text-white [overflow-wrap:anywhere]">
                        {message.content}
                      </p>
                    ) : message.content ? (
                      <div className="w-full space-y-3 text-[15px] leading-relaxed text-white/85 [overflow-wrap:anywhere]
                                      [&_a]:underline [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_li]:ml-5
                                      [&_ol]:list-decimal [&_strong]:font-semibold [&_strong]:text-white [&_ul]:list-disc">
                        <Markdown>{message.content}</Markdown>
                      </div>
                    ) : streaming && last ? (
                      <span className="animate-pulse text-[15px] text-white/40">Thinking…</span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className={cn(column, 'flex-shrink-0 pb-4')}>
        {error && <p role="alert" className="mb-2 text-[13px] text-destructive">{error}</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 pl-3.5
                        focus-within:border-white/25">
          <textarea
            ref={composer}
            id={inputId}
            rows={1}
            value={input}
            onChange={(event) => { setInput(event.target.value); grow(event.target) }}
            onKeyDown={onKeyDown}
            aria-label="Message"
            placeholder="Message Sype"
            className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] text-white
                       placeholder:text-white/35 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void submit(input)}
            disabled={!input.trim() || busy}
            aria-label="Send"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500 text-white transition-colors
                       hover:bg-blue-600 disabled:bg-white/10 disabled:text-white/35"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </div>
        {offline && (
          <p className="mt-2 text-center text-xs text-white/35">
            No model is connected, so replies are a placeholder. Set CHAT_PROVIDER on the backend.
          </p>
        )}
      </div>
    </div>
  )
}

function grow(element: HTMLTextAreaElement | null, reset = false) {
  if (!element) return
  element.style.height = 'auto'
  if (!reset) element.style.height = `${Math.min(Math.max(element.scrollHeight, 36), 200)}px`
}
