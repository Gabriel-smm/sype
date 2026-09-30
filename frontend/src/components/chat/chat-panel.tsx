import { Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Markdown from 'react-markdown'

import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import type { Chat } from '@/hooks/use-chat'
import { cn } from '@/lib/utils'

export const COPILOT_INPUT_ID = 'copilot-input'

const SUGGESTIONS = [
  'What’s on my schedule today?',
  'Show my upcoming deadlines',
  'Add my ethics paper, due Friday, worth 30%',
  'Help me plan my week',
]

/**
 * Sype's Co-Pilot panel. The conversation lives in useChat, above this
 * component, so it survives page changes and the phone sheet closing.
 */
export function ChatPanel({ chat, className, onClose }: { chat: Chat; className?: string; onClose?: () => void }) {
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

  return (
    <Card className={cn('h-full w-full overflow-hidden', className)}>
      <CardHeader
        title="Co-Pilot"
        description="Ask anything about your studies"
        actions={onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close Co-Pilot"><X className="size-4" /></Button>
        )}
      />

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-8">
              <span className="text-4xl font-semibold text-white/15">Sype<span className="text-blue-400/15">.</span></span>
              <div className="flex w-full max-w-xs flex-col gap-2 px-4">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void submit(suggestion)}
                    className="rounded-md border-2 border-sidebar-border px-3 py-1.5 text-left text-sm text-sidebar-foreground/50
                               hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
                {provider && !provider.live && (
                  <p className="mt-2 text-center text-xs text-sidebar-foreground/40">
                    No model is connected, so replies are a placeholder. Set CHAT_PROVIDER on the backend.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-4 px-4 pb-2">
              {messages.map((message, index) => {
                const user = message.role === 'user'
                const last = index === messages.length - 1
                return (
                  <li key={index} className={cn('flex gap-3', user ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-lg rounded-lg px-4 py-2',
                      user ? 'bg-blue-500 text-sidebar-primary-foreground' : 'bg-sidebar-accent/50 text-sidebar-accent-foreground')}>
                      <div className="text-sm leading-relaxed [overflow-wrap:anywhere]">
                        {message.content
                          ? (user
                              ? <p className="whitespace-pre-wrap">{message.content}</p>
                              : <div className="space-y-2 [&_li]:ml-4 [&_ol]:list-decimal [&_strong]:font-semibold [&_ul]:list-disc">
                                  <Markdown>{message.content}</Markdown>
                                </div>)
                          : streaming && last ? <span className="text-sidebar-foreground/60">Thinking...</span> : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className="flex flex-shrink-0 items-stretch gap-2 px-4">
        <textarea
          ref={composer}
          id={COPILOT_INPUT_ID}
          rows={1}
          value={input}
          onChange={(event) => { setInput(event.target.value); grow(event.target) }}
          onKeyDown={onKeyDown}
          aria-label="Message the Co-Pilot"
          placeholder="Ask me anything..."
          className="max-h-[200px] min-h-[40px] flex-1 resize-none overflow-y-auto rounded-md border-2 border-sidebar-border
                     bg-transparent px-3 py-2 text-sm text-sidebar-accent-foreground placeholder:text-sidebar-foreground/40
                     focus:ring-2 focus:ring-sidebar-ring focus:outline-none"
        />
        <Button onClick={() => void submit(input)} disabled={!input.trim() || streaming} aria-label="Send"
                className="h-auto">
          <Send className="size-4" />
        </Button>
      </div>
      {error && <p role="alert" className="-mt-4 px-4 text-sm text-red-500">{error}</p>}
    </Card>
  )
}

function grow(element: HTMLTextAreaElement | null, reset = false) {
  if (!element) return
  element.style.height = 'auto'
  if (!reset) element.style.height = `${Math.min(Math.max(element.scrollHeight, 40), 200)}px`
}
