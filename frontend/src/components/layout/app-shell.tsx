import { MessageSquare } from 'lucide-react'
import type { ReactNode } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'

import { ChatPanel } from '@/components/chat/chat-panel'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip } from '@/components/ui/tooltip'
import type { Chat } from '@/hooks/use-chat'
import { useIsMobile } from '@/hooks/use-mobile'

interface AppShellProps {
  sidebar: ReactNode
  chat: Chat
  /** Whether the chat beside the page is open: a side panel on desktop, a sheet on phones. */
  chatOpen: boolean
  onChatOpenChange: (open: boolean) => void
  /** False on the Chat page itself, which is the chat. */
  chatAvailable: boolean
  banner?: ReactNode
  children: ReactNode
}

/**
 * Sype's app layout. The page takes the full width; the chat opens beside it
 * on demand, split 70/30 and resizable, from a slim rail on the right. Phones
 * get a slim top bar instead, with the chat in a sheet.
 */
export function AppShell({ sidebar, chat, chatOpen, onChatOpenChange, chatAvailable, banner, children }: AppShellProps) {
  const isMobile = useIsMobile()
  const close = () => onChatOpenChange(false)

  const page = <div className="flex h-full w-full min-w-0 flex-1 flex-col py-2 pr-1 pl-2">{children}</div>

  return (
    <>
      {sidebar}
      <SidebarInset className="overflow-hidden">
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
          {isMobile ? (
            <div className="flex h-full min-h-0 w-full flex-col px-2 pb-2">{children}</div>
          ) : chatAvailable && chatOpen ? (
            <Group id="dashboard-panels" orientation="horizontal" className="h-full w-full">
              <Panel id="main-content" defaultSize="70%" minSize="40%">{page}</Panel>
              <Separator id="resize-handle" className="w-1 outline-none data-[separator=hover]:bg-white/10" />
              <Panel id="chat-panel" defaultSize="30%" minSize="20%" maxSize="50%">
                <div className="flex h-full w-full flex-col overflow-hidden py-2 pr-2 pl-1">
                  <ChatPanel chat={chat} onClose={close} />
                </div>
              </Panel>
            </Group>
          ) : (
            <div className="flex h-full w-full">
              {page}
              {chatAvailable ? (
                <div className="flex w-11 shrink-0 flex-col items-center py-3">
                  <Tooltip content="Open chat (C)" side="left">
                    <button type="button" onClick={() => onChatOpenChange(true)} aria-label="Open chat"
                            className="grid size-8 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white">
                      <MessageSquare className="size-4" />
                    </button>
                  </Tooltip>
                </div>
              ) : <div className="w-1 shrink-0" />}
            </div>
          )}
        </div>
      </SidebarInset>

      {isMobile && chatAvailable && (
        <Sheet open={chatOpen} onOpenChange={onChatOpenChange}>
          <SheetContent title="Chat" bare hideHeader className="max-w-full border-0 bg-transparent p-2 shadow-none backdrop-blur-none">
            <ChatPanel chat={chat} onClose={close} className="bg-background" />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
