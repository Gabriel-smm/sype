import { ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import type { Chat } from '@/hooks/use-chat'
import { cn } from '@/lib/utils'
import type { ChatProvider } from '@/types/api'

const OPENERS = [
  'Add my ethics paper, due Friday, worth 30%',
  'What is my heaviest day this week?',
  'Move tomorrow morning’s draft session to the evening',
  'I have not started the stats problem set and it is due Monday',
]

/** The conversation itself lives in useChat, so it survives closing the panel. */
export function ChatPanel({ chat }: { chat: Chat }) {
  const { messages, streaming, provider, error, send } = chat
  const [input, setInput] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streaming])

  async function submit(text: string) {
    if (!text.trim() || streaming) return
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

  const ready = Boolean(input.trim()) && !streaming

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {messages.length === 0 ? (
          <Opening provider={provider} onPick={(text) => void submit(text)} />
        ) : (
          <ul className="space-y-6">
            {messages.map((message, index) => (
              <li key={index} className={message.role === 'user' ? 'flex justify-end' : ''}>
                {message.role === 'user' ? (
                  <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-blue-500 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-white">
                    {message.content}
                  </p>
                ) : (
                  <div className="text-[15px] leading-[1.65] text-foreground/90">
                    {message.content
                      ? message.content.split('\n\n').map((paragraph, key, all) => (
                          <p key={key} className="mb-3 whitespace-pre-wrap last:mb-0">
                            {paragraph}
                            {streaming && index === messages.length - 1 && key === all.length - 1 && <Caret />}
                          </p>
                        ))
                      : <Thinking />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div ref={bottom} />
      </div>

      <div className="border-t border-white/[0.08] px-4 pt-3 pb-4">
        <div className="flex items-end gap-2 rounded-3xl border border-white/20 bg-white/10 py-2 pr-2 pl-5
                        backdrop-blur-md transition-all focus-within:border-blue-400/50 focus-within:bg-white/15">
          <textarea
            ref={composer}
            rows={1}
            value={input}
            onChange={(event) => { setInput(event.target.value); grow(event.target) }}
            onKeyDown={onKeyDown}
            aria-label="Message"
            placeholder="Ask about your week, or describe something new to do"
            className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => void submit(input)}
            disabled={!ready}
            aria-label="Send"
            className={cn('grid size-9 shrink-0 place-items-center rounded-full transition-colors',
              ready ? 'bg-blue-500 text-white hover:scale-105 hover:bg-blue-600' : 'bg-white/10 text-faint')}
          >
            <ArrowUp className="size-4" strokeWidth={2.2} />
          </button>
        </div>
        {provider?.live && (
          <p className="mt-2 text-center text-xs text-faint">
            Chat can read and write your tasks. It never decides where they land on the calendar.
          </p>
        )}
      </div>
    </div>
  )
}

function grow(element: HTMLTextAreaElement | null, reset = false) {
  if (!element) return
  element.style.height = 'auto'
  if (!reset) element.style.height = `${Math.min(element.scrollHeight, 200)}px`
}

function Opening({ provider, onPick }: { provider: ChatProvider | null; onPick: (text: string) => void }) {
  return (
    <div className="pt-2">
      <p className="max-w-[48ch] text-[15px] leading-relaxed text-muted-foreground">
        Describe your work in your own words instead of filling in a form. Scheduling stays
        deterministic either way: chat reads and writes tasks, it never chooses when they happen.
      </p>

      {provider && !provider.live && (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground">
          No model is connected yet. Replies come from a placeholder that reads your message back,
          so the page works end to end. Set <code className="text-accent-ink">CHAT_PROVIDER</code> on the
          backend to change that.
        </p>
      )}

      <ul className="mt-6 flex flex-col items-start gap-2">
        {OPENERS.map((opener) => (
          <li key={opener}>
            <button
              type="button"
              onClick={() => onPick(opener)}
              className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-left text-sm text-white/70
                         backdrop-blur-md transition-all hover:border-blue-400/50 hover:bg-white/15 hover:text-white"
            >
              {opener}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Caret() {
  return (
    <span aria-hidden="true"
          className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-accent-ink" />
  )
}

function Thinking() {
  return (
    <span className="flex gap-1 py-1" aria-label="Thinking">
      {[0, 1, 2].map((index) => (
        <span key={index} className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
              style={{ animationDelay: `${index * 0.15}s` }} />
      ))}
    </span>
  )
}
