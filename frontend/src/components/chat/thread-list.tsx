import { MoreHorizontal, Pencil, SquarePen, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Chat } from '@/hooks/use-chat'
import { groupByDay, type Thread } from '@/lib/chat-threads'
import { cn } from '@/lib/utils'

/** Saved chats, newest first, with New chat on top. Picking one calls `onPicked` (closes the phone sheet). */
export function ThreadList({ chat, onPicked }: { chat: Chat; onPicked?: () => void }) {
  const groups = groupByDay(chat.threads)

  return (
    <nav aria-label="Chats" className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 p-2">
        <button
          type="button"
          onClick={() => { chat.newChat(); onPicked?.() }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-white/80 transition-colors
                     hover:bg-white/[0.06] hover:text-white"
        >
          <SquarePen className="size-4" />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 && <p className="px-2.5 py-2 text-xs text-white/35">Your chats will be saved here.</p>}
        {groups.map((group) => (
          <section key={group.label} className="mt-3 first:mt-1">
            <h3 className="px-2.5 pb-1 text-xs text-white/35">{group.label}</h3>
            <ul>
              {group.threads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} chat={chat} onPicked={onPicked} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  )
}

function ThreadRow({ thread, chat, onPicked }: { thread: Thread; chat: Chat; onPicked?: () => void }) {
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
            className="w-full rounded-lg border border-white/25 bg-transparent px-2.5 py-1.5 text-[13px] text-white focus:outline-none"
          />
        </form>
      </li>
    )
  }

  return (
    <li className={cn('group relative flex items-center rounded-lg transition-colors',
      current ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]')}>
      <button
        type="button"
        onClick={() => { chat.select(thread.id); onPicked?.() }}
        aria-current={current ? 'page' : undefined}
        className={cn('min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[13px]', current ? 'text-white' : 'text-white/65')}
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
