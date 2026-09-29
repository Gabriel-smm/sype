import { MessageCircle, Plus } from 'lucide-react'
import { NavLink } from 'react-router'

import { Kbd } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { NAV_ITEMS } from './nav-items'

export function Logo() {
  return (
    <NavLink to="/" className="rounded-full px-1 text-lg font-bold tracking-tight">
      Sype<span className="text-accent-ink">.</span>
    </NavLink>
  )
}

interface NavbarProps {
  pendingCount: number
  onAdd: () => void
  onChat: () => void
}

/**
 * The floating glass pill from Sype's landing page, carrying the app's pages.
 * Adding a task is the one action always in reach; chat opens beside any page.
 */
export function Navbar({ pendingCount, onAdd, onChat }: NavbarProps) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-4 pt-4">
      <nav
        aria-label="Main"
        className="glass pointer-events-auto mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-full
                   bg-black/50 pr-2 pl-5"
      >
        <Logo />

        <ul className="ml-6 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm transition-colors',
                  isActive
                    ? 'bg-white/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {to === '/tasks' && pendingCount > 0 && (
                  <span className="text-xs text-faint tnum">{pendingCount}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip content="Chat about your week">
            <Button variant="ghost" size="icon" onClick={onChat} aria-label="Open chat">
              <MessageCircle className="size-[18px]" />
            </Button>
          </Tooltip>
          <Button onClick={onAdd} className="max-sm:size-10 max-sm:px-0" aria-keyshortcuts="n">
            <Plus className="size-4" />
            <span className="max-sm:sr-only">Add task</span>
            <Kbd className="border-white/25 bg-white/15 text-white/80 max-md:hidden">N</Kbd>
          </Button>
        </div>
      </nav>
    </header>
  )
}
