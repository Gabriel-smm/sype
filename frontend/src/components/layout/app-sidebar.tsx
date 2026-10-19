import {
  CalendarDays, ChevronRight, ChevronsUpDown, ClipboardList, Keyboard, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus,
  RotateCw,
  Settings2, type LucideIcon,
} from 'lucide-react'
import { Collapsible } from 'radix-ui'
import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'

import { ThreadList } from '@/components/chat/thread-list'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip } from '@/components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar'
import type { Chat } from '@/hooks/use-chat'
import { useSidebar } from '@/hooks/use-sidebar'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  title: string
  icon: LucideIcon
}

// Sype's nav, plus Setup for the weekly schedule and ranking.
const NAV: NavItem[] = [
  { to: '/', title: 'Calendar', icon: CalendarDays },
  { to: '/tasks', title: 'Tasks', icon: ClipboardList },
  { to: '/chat', title: 'Chat', icon: MessageSquare },
  { to: '/setup', title: 'Setup', icon: Settings2 },
]

interface AppSidebarProps {
  studentName: string
  chat: Chat
  onAddTask: () => void
  onRebuild: () => void
}

export function AppSidebar({ studentName, chat, onAddTask, onRebuild }: AppSidebarProps) {
  return (
    <Sidebar>
      <NavHeader />
      <SidebarContent>
        <NavMain onAddTask={onAddTask} />
        <NavChats chat={chat} />
      </SidebarContent>
      <SidebarFooter>
        <NavFooter name={studentName} onAddTask={onAddTask} onRebuild={onRebuild} />
      </SidebarFooter>
    </Sidebar>
  )
}

/** The wordmark and the collapse control. Collapsed, the rail keeps only the expand button. */
function NavHeader() {
  const { state, isMobile, toggleSidebar } = useSidebar()
  const collapsed = state === 'collapsed' && !isMobile
  const toggle = (
    <Tooltip content={collapsed ? 'Expand (Ctrl+B)' : 'Collapse (Ctrl+B)'} side="right">
      <button type="button" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="grid size-8 shrink-0 place-items-center rounded-md text-white/55 transition-colors hover:bg-sidebar-accent hover:text-white">
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </button>
    </Tooltip>
  )
  return (
    <SidebarHeader className={cn('mt-3 flex-row items-center', collapsed ? 'justify-center' : 'mx-2 justify-between')}>
      {!collapsed && (
        <NavLink to="/" className="text-xl font-semibold">Sype<span className="text-blue-400">.</span></NavLink>
      )}
      {!isMobile && toggle}
    </SidebarHeader>
  )
}

function NavMain({ onAddTask }: { onAddTask: () => void }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="New task (N)" onClick={() => { setOpenMobile(false); onAddTask() }}
                               className="text-white/80">
              <Plus />
              <span>New task</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {NAV.map(({ to, title, icon: Icon }) => (
            <SidebarMenuItem key={to}>
              <SidebarMenuButton asChild tooltip={title} isActive={isActive(to)} className="text-white/80">
                <NavLink to={to} onClick={() => setOpenMobile(false)}>
                  <Icon />
                  <span>{title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * Past chats at the bottom of the nav. Open on the Chat page, closed elsewhere: it follows
 * the route on every navigation, and can be toggled by hand in between. Hidden on the icon rail.
 */
function NavChats({ chat }: { chat: Chat }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const onChat = pathname.startsWith('/chat')
  const [open, setOpen] = useState(onChat)
  const [openedOn, setOpenedOn] = useState(pathname)

  if (openedOn !== pathname) {
    setOpenedOn(pathname)
    setOpen(onChat)
  }

  if (state === 'collapsed' && !isMobile) return null

  const startChat = () => {
    chat.newChat()
    navigate('/chat')
    setOpenMobile(false)
  }

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <SidebarGroup className="mt-auto min-h-0">
        <div className="flex items-center gap-1">
          <Collapsible.Trigger
            className="group/chats flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-xs font-medium
                       text-sidebar-foreground/70 transition-colors hover:text-white focus-visible:ring-2
                       focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/chats:rotate-90
                                     motion-reduce:transition-none" />
            Chats
          </Collapsible.Trigger>
          <Tooltip content="New chat" side="right">
            <button type="button" onClick={startChat} aria-label="New chat"
                    className="grid size-7 shrink-0 place-items-center rounded-md text-white/55 transition-colors
                               hover:bg-sidebar-accent hover:text-white">
              <Plus className="size-4" />
            </button>
          </Tooltip>
        </div>
        <Collapsible.Content className="max-h-[45vh] min-h-0 overflow-y-auto pt-1">
          <ThreadList chat={chat} onPicked={() => setOpenMobile(false)} />
        </Collapsible.Content>
      </SidebarGroup>
    </Collapsible.Root>
  )
}

function NavFooter({ name, onAddTask, onRebuild }: { name: string; onAddTask: () => void; onRebuild: () => void }) {
  const { state, isMobile } = useSidebar()
  const collapsed = state === 'collapsed' && !isMobile
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'ME'

  return (
    <SidebarMenu>
      <SidebarMenuItem className={cn(collapsed && 'flex justify-center')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className={cn('data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground',
                collapsed && '!w-auto justify-center !p-2')}
            >
              <Avatar><AvatarFallback>{initials}</AvatarFallback></Avatar>
              {!collapsed && (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">Student</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? 'bottom' : 'right'} align="end"
                               className="w-(--radix-dropdown-menu-trigger-width)">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Avatar><AvatarFallback>{initials}</AvatarFallback></Avatar>
              <span className="grid text-left leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">Student</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onAddTask}><Plus />New task</DropdownMenuItem>
            <DropdownMenuItem onSelect={onRebuild}><RotateCw />Rebuild schedule</DropdownMenuItem>
            <DropdownMenuItem asChild><NavLink to="/setup"><Settings2 />Setup</NavLink></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled><Keyboard />N new task, C chat, Ctrl+B sidebar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
