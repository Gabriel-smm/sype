import {
  CalendarDays, ChevronDown, ChevronsUpDown, ClipboardList, Keyboard, LayoutGrid, Plus, RotateCw,
  Settings2, Sparkles, type LucideIcon,
} from 'lucide-react'
import { Collapsible } from 'radix-ui'
import { NavLink, useLocation, useSearchParams } from 'react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { typeColor, typeLabel } from '@/lib/task-meta'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  title: string
  icon: LucideIcon
}

// Sype's nav, plus Setup for the weekly schedule and ranking.
const NAV: NavItem[] = [
  { to: '/', title: 'Overview', icon: LayoutGrid },
  { to: '/calendar', title: 'Calendar', icon: CalendarDays },
  { to: '/tasks', title: 'Tasks', icon: ClipboardList },
  { to: '/setup', title: 'Setup', icon: Settings2 },
]

interface AppSidebarProps {
  studentName: string
  taskTypes: string[]
  pendingByType: Record<string, number>
  onAddTask: () => void
  onCopilot: () => void
  onRebuild: () => void
}

export function AppSidebar({ studentName, taskTypes, pendingByType, onAddTask, onCopilot, onRebuild }: AppSidebarProps) {
  return (
    <Sidebar>
      <NavHeader />
      <SidebarContent>
        <NavMain onAddTask={onAddTask} onCopilot={onCopilot} />
        <NavSubjects taskTypes={taskTypes} pendingByType={pendingByType} />
      </SidebarContent>
      <SidebarFooter>
        <NavFooter name={studentName} onAddTask={onAddTask} onRebuild={onRebuild} />
      </SidebarFooter>
    </Sidebar>
  )
}

function NavHeader() {
  const { state, isMobile } = useSidebar()
  const collapsed = state === 'collapsed' && !isMobile
  return (
    <SidebarHeader className="mx-2 mt-4">
      <NavLink to="/" className="text-xl font-semibold">
        {collapsed ? 'S' : 'Sype'}<span className="text-blue-400">.</span>
      </NavLink>
    </SidebarHeader>
  )
}

function NavMain({ onAddTask, onCopilot }: { onAddTask: () => void; onCopilot: () => void }) {
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
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Co-pilot" onClick={() => { setOpenMobile(false); onCopilot() }}
                               className="text-white/80">
              <Sparkles />
              <span>Co-pilot</span>
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

/** Sype's "Favorites": here, the kinds of work, each a filter on Tasks. */
function NavSubjects({ taskTypes, pendingByType }: { taskTypes: string[]; pendingByType: Record<string, number> }) {
  const { state, isMobile, setOpenMobile } = useSidebar()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  if (state === 'collapsed' && !isMobile) return null
  const current = pathname === '/tasks' ? params.get('type') : null

  return (
    <Collapsible.Root defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild className="gap-1 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <Collapsible.Trigger>
            Subjects
            <ChevronDown className="ml-auto transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
          </Collapsible.Trigger>
        </SidebarGroupLabel>
        <Collapsible.Content>
          <SidebarGroupContent>
            <SidebarMenu>
              {taskTypes.map((type) => (
                <SidebarMenuItem key={type}>
                  <SidebarMenuButton asChild isActive={current === type}>
                    <NavLink to={`/tasks?type=${type}`} onClick={() => setOpenMobile(false)} className="flex items-center gap-3">
                      <span className="size-3 shrink-0 rounded-[4px]" style={{ background: typeColor(type) }} />
                      <span className="flex-1 truncate">{typeLabel(type)}</span>
                      {pendingByType[type] > 0 && (
                        <span className="text-xs text-sidebar-foreground/40 tnum">{pendingByType[type]}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
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
            <DropdownMenuItem disabled><Keyboard />N new task, Ctrl+B sidebar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
