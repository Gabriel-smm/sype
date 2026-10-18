import { Maximize2, SquarePen, X } from 'lucide-react'
import { Link } from 'react-router'

import { ChatConversation } from '@/components/chat/chat-conversation'
import { Tooltip } from '@/components/ui/tooltip'
import type { Chat } from '@/hooks/use-chat'
import { NEW_CHAT_TITLE } from '@/lib/chat-threads'
import { cn } from '@/lib/utils'

export const COPILOT_INPUT_ID = 'copilot-input'

const iconButton = 'grid size-7 place-items-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white'

/**
 * The chat beside any page. It shows the same thread as the Chat page, so a
 * question asked here can be picked up there at full width.
 */
export function ChatPanel({ chat, className, onClose }: { chat: Chat; className?: string; onClose: () => void }) {
  return (
    <section aria-label="Chat" onKeyDown={(event) => { if (event.key === 'Escape' && !event.defaultPrevented) onClose() }}
             className={cn('flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/10', className)}>
      <header className="flex flex-shrink-0 items-center gap-1 border-b border-white/[0.06] py-2 pr-2 pl-4">
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{chat.active?.title ?? NEW_CHAT_TITLE}</h2>
        <Tooltip content="New chat">
          <button type="button" onClick={chat.newChat} aria-label="New chat" className={iconButton}>
            <SquarePen className="size-4" />
          </button>
        </Tooltip>
        <Tooltip content="Open full page">
          <Link to="/chat" onClick={onClose} aria-label="Open chat as a full page" className={iconButton}>
            <Maximize2 className="size-4" />
          </Link>
        </Tooltip>
        <Tooltip content="Close (C)">
          <button type="button" onClick={onClose} aria-label="Close chat" className={iconButton}>
            <X className="size-4" />
          </button>
        </Tooltip>
      </header>
      <div className="min-h-0 flex-1">
        <ChatConversation chat={chat} variant="panel" inputId={COPILOT_INPUT_ID} autoFocus />
      </div>
    </section>
  )
}
