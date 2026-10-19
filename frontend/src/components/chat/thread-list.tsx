import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Chat } from '@/hooks/use-chat'
import { filterThreads, groupByDay, type Thread } from '@/lib/chat-threads'
import { cn } from '@/lib/utils'

/**
 * Saved chats, newest first, grouped by day, narrowed by `query`. Picking one opens it on the
 * Chat page and calls `onPicked`.
 */
export function ThreadList({ chat, query = '', onPicked }: { chat: Chat; query?: string; onPicked?: () => void }) {
  const groups = groupByDay(filterThreads(chat.threads, query))
  const empty = query.trim() ? 'No chats match that search.' : 'Your chats will be saved here.'

  return (
    <nav aria-label="Chats">
      {groups.length === 0 && <p className="px-2.5 py-1.5 text-[13px] text-white/35">{empty}</p>}
      {groups.map((group) => (
        <section key={group.label} className="mt-3 first:mt-0">
          <h3 className="px-2.5 pb-1 text-xs text-white/35">{group.label}</h3>
          <ul className="flex flex-col gap-px">
            {group.threads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} chat={chat} onPicked={onPicked} />
            ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}

function ThreadRow({ thread, chat, onPicked }: { thread: Thread; chat: Chat; onPicked?: () => void }) {
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(thread.title)
  const current = chat.active?.id === thread.id

  function save(event: FormEvent) {
    event.preventDefault()
    chat.rename(thread.id, draft)
    setRenaming(false)
  }

  if (renaming) {
    return (
      <li>
        <form onSubmit={save}>
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => { if (event.key === 'Escape') { setDraft(thread.title); setRenaming(false) } }}
            aria-label="Chat name"
            className="w-full rounded-md border border-white/25 bg-transparent h-9 px-2.5 text-[14px] text-white focus:outline-none"
          />
        </form>
      </li>
    )
  }

  return (
    <li className={cn('group relative flex items-center rounded-md transition-colors',
      current ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/60')}>
      <button
        type="button"
        onClick={() => { chat.select(thread.id); navigate('/chat'); onPicked?.() }}
        aria-current={current ? 'page' : undefined}
        className={cn('h-9 min-w-0 flex-1 truncate px-2.5 text-left text-[14px]', current ? 'text-white' : 'text-white/65')}
      >
        {thread.title}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Options for ${thread.title}`}
          className="mr-1 grid size-6 shrink-0 place-items-center rounded-md text-white/50 opacity-0 transition-opacity
                     group-hover:opacity-100 hover:text-white focus-visible:opacity-100 data-[state=open]:opacity-100
                     max-md:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        {/* Focus goes to the rename field, not back to the trigger. */}
        <DropdownMenuContent align="start" className="min-w-36" onCloseAutoFocus={(event) => event.preventDefault()}>
          <DropdownMenuItem onSelect={() => { setDraft(thread.title); setRenaming(true) }}><Pencil />Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => chat.remove(thread.id)} className="text-destructive">
            <Trash2 />Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
