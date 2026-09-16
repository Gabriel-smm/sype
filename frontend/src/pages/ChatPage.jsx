import { useEffect, useRef, useState } from 'react'

import { api } from '../api'

const OPENERS = [
  'Add my ethics paper, due Friday, worth 30%',
  'What is my heaviest day this week?',
  'Move tomorrow morning’s draft session to the evening',
  'I have not started the stats problem set and it is due Monday',
]

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [provider, setProvider] = useState(null)
  const [error, setError] = useState(null)

  const bottom = useRef(null)
  const composer = useRef(null)

  useEffect(() => {
    api.chatProvider().then(setProvider).catch(() => setProvider(null))
  }, [])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streaming])

  async function send(text) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const history = [...messages, { role: 'user', content: trimmed }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)
    setError(null)

    try {
      await api.chat(history, {
        onDelta: (reply) =>
          setMessages([...history, { role: 'assistant', content: reply }]),
      })
    } catch (err) {
      setError(err.message)
      setMessages(history)
    } finally {
      setStreaming(false)
      composer.current?.focus()
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(input)
    }
  }

  function grow(element) {
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[740px] px-4 py-6 md:px-6">
          {messages.length === 0 ? (
            <Opening provider={provider} onPick={send} />
          ) : (
            <ul className="space-y-6">
              {messages.map((message, index) => (
                <li key={index} className={message.role === 'user' ? 'flex justify-end' : ''}>
                  {message.role === 'user' ? (
                    <p className="max-w-[80%] rounded-2xl rounded-br-md bg-ink-800 px-3.5 py-2
                                  text-[14px] leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  ) : (
                    <div className="text-[14.5px] leading-[1.65] text-chalk">
                      {message.content
                        ? message.content.split('\n\n').map((paragraph, key, all) => (
                            <p key={key} className="mb-3 last:mb-0 whitespace-pre-wrap">
                              {paragraph}
                              {streaming
                                && index === messages.length - 1
                                && key === all.length - 1 && <Caret />}
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
            <p className="mt-6 rounded-lg border border-alarm/30 bg-alarm/[0.07] px-3 py-2 text-[13px] text-alarm">
              {error}
            </p>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className="border-t border-ink-800 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto w-full max-w-[740px] px-4 py-3 md:px-6">
          <div className="flex items-end gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-3 py-2
                          transition-colors focus-within:border-ink-600">
            <textarea
              ref={composer}
              rows={1}
              value={input}
              onChange={(event) => { setInput(event.target.value); grow(event.target) }}
              onKeyDown={onKeyDown}
              placeholder="Ask about your week, or describe something new to do"
              className="max-h-[200px] flex-1 resize-none bg-transparent py-1 text-[14.5px]
                         outline-none placeholder:text-chalk-faint"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              aria-label="Send"
              className="mb-0.5 grid size-8 shrink-0 place-items-center rounded-full
                         transition-colors disabled:opacity-30"
              style={{ background: input.trim() && !streaming ? 'var(--color-lamp)' : 'var(--color-ink-700)' }}
            >
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none"
                   stroke={input.trim() && !streaming ? '#1a1406' : 'currentColor'}
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 13V3M4 6.5L8 2.5l4 4" />
              </svg>
            </button>
          </div>

          <p className="mt-2 text-center text-[11px] text-chalk-faint">
            {provider?.live
              ? 'Chat can read and write your tasks. It never decides where they land on the calendar.'
              : 'No language model is connected yet, so replies are a placeholder.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function Opening({ provider, onPick }) {
  return (
    <div className="pt-[8vh] pb-4">
      <h1 className="font-display text-[26px] tracking-tight">What are you working on?</h1>
      <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-chalk-dim">
        Describe your work in your own words instead of filling in a form. Scheduling stays
        deterministic either way — chat reads and writes tasks, it never chooses when they happen.
      </p>

      {provider && !provider.live && (
        <p className="mt-4 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-[13px] text-chalk-dim">
          No model is connected yet. Replies come from a placeholder that reads your message back,
          so the page works end to end. Set <code className="text-lamp">CHAT_PROVIDER</code> on the
          backend to change that.
        </p>
      )}

      <ul className="mt-6 flex flex-col items-start gap-2">
        {OPENERS.map((opener) => (
          <li key={opener}>
            <button
              type="button"
              onClick={() => onPick(opener)}
              className="rounded-full border border-ink-700 px-3.5 py-1.5 text-left text-[13px]
                         text-chalk-dim transition-colors hover:border-ink-600 hover:text-chalk"
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
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-lamp
                 motion-safe:animate-[blink_1s_steps(2)_infinite]"
    >
      <style>{'@keyframes blink { 50% { opacity: 0 } }'}</style>
    </span>
  )
}

function Thinking() {
  return (
    <span className="flex gap-1 py-1" aria-label="Thinking">
      <style>{'@keyframes bob { 0%,80%,100% { opacity:.25 } 40% { opacity:1 } }'}</style>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-chalk-dim motion-safe:animate-[bob_1.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${index * 0.15}s` }}
        />
      ))}
    </span>
  )
}
