import { MessageSquare } from 'lucide-react'
import type { ReactNode } from 'react'

import { ChatPanel } from '@/components/chat/chat-panel'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import type { Chat } from '@/hooks/use-chat'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface AppShellProps {
  sidebar: ReactNode
  chat: Chat
  /** Whether the chat drawer is open over the page. */
  chatOpen: boolean
  onChatOpenChange: (open: boolean) => void
  /** False on the Chat page itself, which is the chat. */
  chatAvailable: boolean
  banner?: ReactNode
  children: ReactNode
}

/**
 * Sype's app layout. The page always takes the full width; the chat slides
 * over it as a drawer, opened from "Ask Sype" in the corner or with `C`.
 * Phones get a slim top bar instead, and the drawer fills the screen.
 */
export function AppShell({ sidebar, chat, chatOpen, onChatOpenChange, chatAvailable, banner, children }: AppShellProps) {
  const isMobile = useIsMobile()
  const close = () => onChatOpenChange(false)

  return (
    <>
      {sidebar}
      <SidebarInset className="relative overflow-hidden">
        {isMobile && (
          <header className="flex h-12 flex-shrink-0 items-center gap-2 px-3">
            <SidebarTrigger />
            <span className="text-lg font-semibold">Sype<span className="text-blue-400">.</span></span>
            {chatAvailable && (
              <button
                type="button"
                onClick={() => onChatOpenChange(true)}
                className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white"
              >
                <MessageSquare className="size-4" />
                Chat
              </button>
            )}
          </header>
        )}
        {banner}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={cn('flex h-full min-h-0 w-full min-w-0 flex-col', isMobile ? 'px-2 pb-2' : 'p-2')}>{children}</div>
        </div>

        {!isMobile && chatAvailable && !chatOpen && (
          <button
            type="button"
            onClick={() => onChatOpenChange(true)}
            className="absolute right-5 bottom-5 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-background
                       py-1.5 pr-1.5 pl-3 text-[13px] text-white/70 transition-colors hover:border-white/25 hover:text-white
                       focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:outline-none"
          >
            <MessageSquare className="size-4" />
            Ask Sype
            <kbd className="grid size-5 place-items-center rounded-full bg-white/[0.08] font-sans text-[11px] text-white/50">C</kbd>
          </button>
        )}
      </SidebarInset>

      {chatAvailable && (
        <Sheet open={chatOpen} onOpenChange={onChatOpenChange}>
          <SheetContent
            title="Chat"
            bare
            hideHeader
            overlayClassName={isMobile ? undefined : 'bg-black/30 backdrop-blur-none'}
            className={cn(
              'border-0 bg-transparent shadow-none backdrop-blur-none',
              isMobile ? 'max-w-full' : 'max-w-[min(94vw,440px)]',
            )}
          >
            <ChatPanel chat={chat} onClose={close} className="bg-background" />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
