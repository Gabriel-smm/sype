import { CalendarDays, ListChecks, SlidersHorizontal, Sun, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/week', label: 'Week', icon: CalendarDays },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/setup', label: 'Setup', icon: SlidersHorizontal },
]
