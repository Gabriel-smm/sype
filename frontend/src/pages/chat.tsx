import { ChevronDown, Pencil, SquarePen, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ChatConversation } from '@/components/chat/chat-conversation'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Chat } from '@/hooks/use-chat'
import { useIsMobile } from '@/hooks/use-mobile'
import { NEW_CHAT_TITLE } from '@/lib/chat-threads'

/**
 * Chat edge to edge: the title in a slim bar, the conversation in a centred reading column.
 * Past chats are listed in the sidebar.
 */
export function ChatPage({ chat }: { chat: Chat }) {
  const isMobile = useIsMobile()

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="flex h-14 flex-shrink-0 items-center gap-2 px-4">
        <ChatTitle chat={chat} />
        {isMobile && (
          <button type="button" onClick={chat.newChat} aria-label="New chat"
                  className="ml-auto grid size-8 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white">
            <SquarePen className="size-4" />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1">
        <ChatConversation chat={chat} variant="page" inputId="chat-page-input" autoFocus={!isMobile} />
      </div>
    </div>
  )
}

/** The chat's name. A saved chat opens a menu to rename or delete it. */
function ChatTitle({ chat }: { chat: Chat }) {
  const { active } = chat
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')

  if (!active) {
    return <h1 className="min-w-0 truncate px-1 text-[15px] text-white/90">{NEW_CHAT_TITLE}</h1>
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (active) chat.rename(active.id, draft)
    setRenaming(false)
  }

  if (renaming) {
    return (
      <form onSubmit={save} className="min-w-0 flex-1">
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => { if (event.key === 'Escape') setRenaming(false) }}
          aria-label="Chat name"
          className="w-full max-w-md rounded-md border border-white/25 bg-transparent px-2 py-1 text-[15px] text-white
                     focus:outline-none"
        />
      </form>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[15px] text-white/90 transition-colors
                   hover:bg-white/[0.06] data-[state=open]:bg-white/[0.06]"
      >
        <h1 className="truncate">{active.title}</h1>
        <ChevronDown className="size-4 shrink-0 text-white/50" />
      </DropdownMenuTrigger>
      {/* Focus goes to the rename field, not back to the trigger. */}
      <DropdownMenuContent align="start" className="min-w-40" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DropdownMenuItem onSelect={() => { setDraft(active.title); setRenaming(true) }}><Pencil />Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => chat.remove(active.id)} className="text-destructive"><Trash2 />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
