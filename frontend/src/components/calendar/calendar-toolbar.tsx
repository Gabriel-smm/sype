import { ChevronDown, ChevronLeft, ChevronRight, PanelLeft, RotateCw, Search, X } from 'lucide-react'
import type { FormEvent, RefObject } from 'react'

import { Kbd } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import { VIEWS, type CalendarView } from '@/lib/calendar-view'
import { cn } from '@/lib/utils'

export interface ToolbarSearch {
  open: boolean
  query: string
  onOpen: () => void
  onQueryChange: (query: string) => void
  onSubmit: () => void
  onClear: () => void
}

interface CalendarToolbarProps {
  view: CalendarView
  title: string
  busy: boolean
  panelOpen: boolean
  search: ToolbarSearch
  searchInputRef: RefObject<HTMLInputElement | null>
  onTogglePanel: () => void
  onToday: () => void
  onStep: (direction: 1 | -1) => void
  onView: (view: CalendarView) => void
  onRegenerate: () => void
}

const icon = 'grid size-9 shrink-0 place-items-center rounded-full text-sidebar-foreground hover:bg-white/10 disabled:opacity-40'

const stepLabel: Record<CalendarView, string> = {
  day: 'day', '3day': '3 days', week: 'week', month: 'month', schedule: '30 days',
}

/** The 56px bar over the calendar: panel, Today, arrows and title; search, view and Rebuild. */
export function CalendarToolbar({
  view, title, busy, panelOpen, search, searchInputRef, onTogglePanel, onToday, onStep, onView, onRegenerate,
}: CalendarToolbarProps) {
  const current = VIEWS.find((entry) => entry.view === view) ?? VIEWS[2]
  const submit = (event: FormEvent) => {
    event.preventDefault()
    search.onSubmit()
  }

  return (
    <div className="flex h-14 shrink-0 items-center gap-1 px-2 sm:gap-2 sm:px-3">
      <button type="button" onClick={onTogglePanel} aria-label={panelOpen ? 'Hide side panel' : 'Show side panel'}
              aria-expanded={panelOpen} className={icon}>
        <PanelLeft className="size-5" />
      </button>

      <div className={cn('flex min-w-0 items-center gap-1 sm:gap-2', search.open && 'max-sm:hidden')}>
        <button
          type="button"
          onClick={onToday}
          className="h-9 shrink-0 rounded-full border border-white/20 px-4 text-sm font-medium hover:bg-white/10"
        >
          Today
        </button>
        <div className="flex shrink-0">
          <button type="button" onClick={() => onStep(-1)} aria-label={`Previous ${stepLabel[view]}`} className={icon}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => onStep(1)} aria-label={`Next ${stepLabel[view]}`} className={icon}>
            <ChevronRight className="size-5" />
          </button>
        </div>
        <h2 className="min-w-0 truncate text-lg font-normal sm:text-xl" aria-live="polite">{title}</h2>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-1">
        {search.open ? (
          <form role="search" onSubmit={submit}
                className="flex h-10 min-w-0 items-center gap-1 rounded-lg bg-white/10 pr-1 pl-3 max-sm:flex-1 sm:w-72">
            <Search aria-hidden className="size-4 shrink-0 text-faint" />
            <input
              ref={searchInputRef}
              autoFocus
              value={search.query}
              onChange={(event) => search.onQueryChange(event.target.value)}
              placeholder="Search events"
              aria-label="Search events"
              enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            />
            <button type="button" onClick={search.onClear} aria-label="Clear search"
                    className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-white/10 hover:text-foreground">
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <button type="button" onClick={search.onOpen} aria-label="Search events" className={icon}>
            <Search className="size-5" />
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`View: ${current.label}`}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1 rounded-md border border-white/20 px-3 text-sm font-medium hover:bg-white/10',
                search.open && 'max-sm:hidden',
              )}
            >
              {current.label}
              <ChevronDown aria-hidden className="size-4 text-faint" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {VIEWS.map((entry) => (
              <DropdownMenuItem key={entry.view} onSelect={() => onView(entry.view)}
                                className={cn(entry.view === view && 'bg-white/[0.06]')}>
                <span className="flex-1">{entry.label}</span>
                <Kbd className="uppercase">{entry.key}</Kbd>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip content="Rebuild the week. This also undoes sessions you dragged.">
          <button type="button" onClick={onRegenerate} disabled={busy} aria-label="Rebuild schedule"
                  className={cn(icon, search.open && 'max-sm:hidden')}>
            <RotateCw className={cn('size-5', busy && 'animate-spin')} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
