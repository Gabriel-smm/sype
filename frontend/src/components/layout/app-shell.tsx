import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'

import { ChatPanel } from '@/components/chat/chat-panel'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import type { Chat } from '@/hooks/use-chat'
import { useIsMobile } from '@/hooks/use-mobile'

interface AppShellProps {
  sidebar: ReactNode
  chat: Chat
  chatSheetOpen: boolean
  onChatSheetChange: (open: boolean) => void
  banner?: ReactNode
  children: ReactNode
}

/**
 * Sype's app layout: the page on the left, the Co-Pilot on the right, split
 * 70/30 and resizable. Phones get a slim top bar instead, with the Co-Pilot
 * in a sheet.
 */
export function AppShell({ sidebar, chat, chatSheetOpen, onChatSheetChange, banner, children }: AppShellProps) {
  const isMobile = useIsMobile()

  return (
    <>
      {sidebar}
      <SidebarInset className="overflow-hidden">
        {isMobile && (
          <header className="flex h-12 flex-shrink-0 items-center gap-2 px-3">
            <SidebarTrigger />
            <span className="text-lg font-semibold">Sype<span className="text-blue-400">.</span></span>
            <button
              type="button"
              onClick={() => onChatSheetChange(true)}
              className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-sidebar-foreground/80 hover:bg-white/10"
            >
              <Sparkles className="size-4 text-purple-400" />
              Co-Pilot
            </button>
          </header>
        )}
        {banner}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isMobile ? (
            <div className="flex h-full min-h-0 w-full flex-col px-2 pb-2">{children}</div>
          ) : (
            <Group id="dashboard-panels" orientation="horizontal" className="h-full w-full">
              <Panel id="main-content" defaultSize="70%" minSize="40%">
                <div className="flex h-full w-full flex-col py-2 pr-1 pl-2">{children}</div>
              </Panel>
              <Separator id="resize-handle" className="w-1 outline-none data-[separator=hover]:bg-white/10" />
              <Panel id="chat-panel" defaultSize="30%" minSize="20%" maxSize="50%">
                <div className="flex h-full w-full flex-col overflow-hidden py-2 pr-2 pl-1">
                  <ChatPanel chat={chat} />
                </div>
              </Panel>
            </Group>
          )}
        </div>
      </SidebarInset>

      {isMobile && (
        <Sheet open={chatSheetOpen} onOpenChange={onChatSheetChange}>
          <SheetContent title="Co-Pilot" bare hideHeader className="max-w-full border-0 bg-transparent p-2 shadow-none backdrop-blur-none">
            <ChatPanel chat={chat} className="bg-[hsl(240_5.9%_10%)]" onClose={() => onChatSheetChange(false)} />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
