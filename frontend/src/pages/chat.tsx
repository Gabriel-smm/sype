import { PanelLeft, SquarePen } from 'lucide-react'
import { useState } from 'react'

import { ChatConversation } from '@/components/chat/chat-conversation'
import { ThreadList } from '@/components/chat/thread-list'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { Chat } from '@/hooks/use-chat'
import { useIsMobile } from '@/hooks/use-mobile'
import { NEW_CHAT_TITLE } from '@/lib/chat-threads'

/** Chat at full width: saved chats on the left, the conversation in a reading column. */
export function ChatPage({ chat }: { chat: Chat }) {
  const isMobile = useIsMobile()
  const [listOpen, setListOpen] = useState(false)

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden rounded-xl border border-white/10">
      {!isMobile && (
        <aside className="w-60 shrink-0 border-r border-white/[0.06]">
          <ThreadList chat={chat} />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-shrink-0 items-center gap-2 px-3">
          {isMobile && (
            <button type="button" onClick={() => setListOpen(true)} aria-label="Show chats"
                    className="grid size-8 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white">
              <PanelLeft className="size-4" />
            </button>
          )}
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

      {isMobile && (
        <Sheet open={listOpen} onOpenChange={setListOpen}>
          <SheetContent title="Chats" bare hideHeader className="max-w-[min(85vw,320px)]">
            <div className="h-full pt-3"><ThreadList chat={chat} onPicked={() => setListOpen(false)} /></div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
