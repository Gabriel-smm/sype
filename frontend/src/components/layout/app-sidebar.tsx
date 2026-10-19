import {
  CalendarDays, ChevronDown, ChevronRight, ClipboardList, Keyboard, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus,
  RotateCw, Search,
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
  const [query, setQuery] = useState('')

  return (
    <Sidebar>
      <NavHeader />
      <NavSearch query={query} onQueryChange={setQuery} />
      <SidebarContent className="gap-0">
        <NavMain onAddTask={onAddTask} />
        <NavChats chat={chat} query={query} />
      </SidebarContent>
      <SidebarFooter className="border-t border-white/10">
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
        {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
      </button>
    </Tooltip>
  )
  return (
    <SidebarHeader className={cn('h-14 flex-row items-center gap-2 py-0', collapsed ? 'justify-center' : 'px-3')}>
      {!isMobile && toggle}
      {!collapsed && (
        <NavLink to="/" className={cn('text-xl font-semibold', isMobile && 'pl-1')}>Sype<span className="text-blue-400">.</span></NavLink>
      )}
    </SidebarHeader>
  )
}

function NavMain({ onAddTask }: { onAddTask: () => void }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton size="nav" tooltip="New task (N)" onClick={() => { setOpenMobile(false); onAddTask() }}
                               className="text-white/85">
              <span className="-mx-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/10">
                <Plus className="size-4" />
              </span>
              <span>New task</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {NAV.map(({ to, title, icon: Icon }) => (
            <SidebarMenuItem key={to}>
              <SidebarMenuButton asChild size="nav" tooltip={title} isActive={isActive(to)} className="text-white/85">
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

/** Search over past chats. Typing opens the Chats section. Hidden on the icon rail. */
function NavSearch({ query, onQueryChange }: { query: string; onQueryChange: (query: string) => void }) {
  const { state, isMobile } = useSidebar()
  if (state === 'collapsed' && !isMobile) return null

  return (
    <div className="px-3 pb-2">
      <label className="flex h-10 items-center gap-2.5 rounded-lg border border-white/15 px-3 text-white/45
                        transition-colors focus-within:border-white/30 focus-within:text-white/70">
        <Search className="size-4 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') onQueryChange('') }}
          placeholder="Search chats"
          aria-label="Search chats"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/45 focus:outline-none
                     [&::-webkit-search-cancel-button]:hidden"
        />
      </label>
    </div>
  )
}

/**
 * Past chats, right under the page links. Open on the Chat page, closed elsewhere: it follows the
 * route on every navigation, can be toggled by hand in between, and stays open while searching.
 * Hidden on the icon rail.
 */
function NavChats({ chat, query }: { chat: Chat; query: string }) {
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

  const searching = query.trim() !== ''
  const startChat = () => {
    chat.newChat()
    navigate('/chat')
    setOpenMobile(false)
  }

  return (
    <Collapsible.Root open={open || searching} onOpenChange={setOpen} asChild>
      <SidebarGroup className="mt-5 min-h-0 flex-1">
        <div className="flex items-center gap-1 pl-0.5">
          <Collapsible.Trigger
            className="group/chats flex h-8 items-center gap-1 rounded-md px-2 text-[14px] text-white/45
                       transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-sidebar-ring
                       focus-visible:outline-none"
          >
            Chats
            <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/chats:rotate-90
                                     motion-reduce:transition-none" />
          </Collapsible.Trigger>
          <Tooltip content="New chat" side="right">
            <button type="button" onClick={startChat} aria-label="New chat"
                    className="ml-auto grid size-8 shrink-0 place-items-center rounded-md text-white/50 transition-colors
                               hover:bg-sidebar-accent hover:text-white">
              <Plus className="size-4" />
            </button>
          </Tooltip>
        </div>
        <Collapsible.Content className="min-h-0 flex-1 overflow-y-auto pt-1">
          <ThreadList chat={chat} query={query} onPicked={() => setOpenMobile(false)} />
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
                  <ChevronDown className="ml-auto size-4 text-white/50" />
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
