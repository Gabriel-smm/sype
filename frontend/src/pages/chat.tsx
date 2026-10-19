import { SquarePen } from 'lucide-react'

import { ChatConversation } from '@/components/chat/chat-conversation'
import type { Chat } from '@/hooks/use-chat'
import { useIsMobile } from '@/hooks/use-mobile'
import { NEW_CHAT_TITLE } from '@/lib/chat-threads'

/** Chat at full width, the conversation in a reading column. Past chats are listed in the sidebar. */
export function ChatPage({ chat }: { chat: Chat }) {
  const isMobile = useIsMobile()

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-white/10">
      <header className="flex h-12 flex-shrink-0 items-center gap-2 px-3">
        <h1 className="min-w-0 flex-1 truncate px-1 text-[13px] font-semibold text-white/90">
          {chat.active?.title ?? NEW_CHAT_TITLE}
        </h1>
        {isMobile && (
          <button type="button" onClick={chat.newChat} aria-label="New chat"
                  className="grid size-8 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white">
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
