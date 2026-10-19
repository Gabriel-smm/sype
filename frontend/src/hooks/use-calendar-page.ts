import { addDays, startOfDay } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import type { ColorPick } from '@/components/calendar/color-category-picker'
import type { EventDialogInitial } from '@/components/calendar/event-dialog'
import type { QuickCreateDraft } from '@/components/calendar/quick-create-popover'
import type { GridSelection } from '@/components/calendar/time-grid'
import { useCalendar } from '@/hooks/use-calendar'
import { useIsMobile } from '@/hooks/use-mobile'
import { api } from '@/lib/api'
import {
  VIEWS, parseViewParams, quickDraftFor, rangeFor, step, toViewParams, type CalendarView,
} from '@/lib/calendar-view'
import { resolveShortcut } from '@/lib/shortcuts'
import { errorMessage, isTyping } from '@/lib/utils'
import type {
  CalendarEvent, CalendarEventChanges, CalendarEventInput, Occurrence, Schedule, ScheduleSlot, TaskInput,
} from '@/types/api'

const VIEW_KEY = 'sype.calendar.view'
const PANEL_KEY = 'sype.calendar.panel'

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode: the default is fine */ }
}
const storedView = () => VIEWS.find((entry) => entry.view === read(VIEW_KEY))?.view ?? null

/** The series row as dialog input; without `id` it becomes a copy. */
function dialogInitial(series: CalendarEvent, withId: boolean): EventDialogInitial {
  return {
    ...(withId ? { id: series.id } : {}),
    calendar_id: series.calendar_id, title: series.title, description: series.description,
    location: series.location, start: series.start, end: series.end, all_day: series.all_day,
    busy: series.busy, kind: series.kind, category_id: series.category_id, color_key: series.color_key,
    recurrence: series.recurrence,
  }
}

const itemElement = (id: string) =>
  document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)

export interface CalendarPageRefs {
  /** Fallback anchor for a search result's popover. */
  toolbar: RefObject<HTMLDivElement | null>
  /** The view area; keyboard quick-create anchors to it. */
  main: RefObject<HTMLDivElement | null>
  searchInput: RefObject<HTMLInputElement | null>
}

interface Options {
  schedule: Schedule
  createTask: (input: TaskInput) => Promise<unknown>
  refs: CalendarPageRefs
}

/**
 * The calendar page's state: view and date in the URL, the side panel, the
 * popovers and dialogs, search, focus return and the page's shortcuts.
 */
export function useCalendarPage({ schedule, createTask, refs }: Options) {
  const { toolbar, main, searchInput } = refs
  const mobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const fallback: CalendarView = storedView() ?? (mobile ? 'day' : 'week')
  const { view, date } = useMemo(() => parseViewParams(params, fallback), [params, fallback])
  const range = useMemo(() => rangeFor(view, date), [view, date])
  const calendar = useCalendar(range, schedule)

  const navigate = useCallback((nextView: CalendarView, nextDate: Date) => {
    write(VIEW_KEY, nextView)
    setParams(toViewParams(nextView, nextDate))
  }, [setParams])

  // Side panel: remembered on desktop, a sheet on phones.
  const [panelOpen, setPanelOpen] = useState(() => read(PANEL_KEY) !== 'closed')
  const [sheetOpen, setSheetOpen] = useState(false)
  const togglePanel = () => {
    if (mobile) { setSheetOpen((open) => !open); return }
    write(PANEL_KEY, panelOpen ? 'closed' : 'open')
    setPanelOpen(!panelOpen)
  }

  // Overlays.
  const [popover, setPopover] = useState<{ occurrence: Occurrence; anchor: DOMRect } | null>(null)
  // Kept after closing (anchor null) so the popover can animate out and return focus.
  const [quick, setQuick] = useState<{ draft: QuickCreateDraft; anchor: DOMRect | null } | null>(null)
  const [dialog, setDialog] = useState<{ initial: EventDialogInitial; open: boolean } | null>(null)
  const [slot, setSlot] = useState<ScheduleSlot | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  // The block an overlay was opened from, refocused when it closes.
  const origin = useRef<HTMLElement | null>(null)
  // Set while a popover closes because the event dialog is opening.
  const toDialog = useRef(false)
  const remember = () => {
    const active = document.activeElement
    origin.current = active instanceof HTMLElement && active !== document.body ? active : null
  }
  const refocus = useCallback(() => {
    if (!origin.current?.isConnected) return false
    origin.current.focus({ preventScroll: true })
    return true
  }, [])
  const onCloseAutoFocus = useCallback((event: Event) => {
    if (toDialog.current) {
      toDialog.current = false
      event.preventDefault()
    } else if (refocus()) {
      event.preventDefault()
    }
  }, [refocus])
  const onDialogCloseAutoFocus = useCallback((event: Event) => {
    toDialog.current = false
    if (refocus()) event.preventDefault()
  }, [refocus])

  // The popover shows the live occurrence, so a colour change shows at once.
  const shownOccurrence = popover
    ? calendar.occurrences.find((o) => o.id === popover.occurrence.id) ?? popover.occurrence
    : null
  const selected: GridSelection = popover
    ? { kind: 'event', id: popover.occurrence.id }
    : slot ? { kind: 'slot', id: slot.id } : null

  const closeQuick = () => setQuick((current) => current && { ...current, anchor: null })
  const quickOpen = quick?.anchor != null

  const selectEvent = (occurrence: Occurrence, anchor: DOMRect) => {
    remember()
    closeQuick()
    setPopover({ occurrence, anchor })
  }
  const selectSlot = (next: ScheduleSlot) => {
    setPopover(null)
    setSlot(next)
  }
  const openDraft = (draft: QuickCreateDraft, anchor: DOMRect) => {
    remember()
    setPopover(null)
    setQuick({ draft, anchor })
  }
  const createDraft = (start: Date, end: Date, anchor: DOMRect) => openDraft({ start, end, allDay: false }, anchor)
  const createAllDay = (day: Date, anchor: DOMRect) =>
    openDraft({ start: startOfDay(day), end: addDays(startOfDay(day), 1), allDay: true }, anchor)
  /** `c` and the Create button: all day in month view, else the next half hour on the shown date. */
  const createHere = (anchor: DOMRect) => {
    if (view === 'month') createAllDay(date, anchor)
    else {
      const { start, end } = quickDraftFor(date, new Date())
      createDraft(start, end, anchor)
    }
  }

  const openDialog = (occurrence: Occurrence, asCopy: boolean) => {
    toDialog.current = true
    api.getCalendarEvent(occurrence.event_id)
      .then((series) => setDialog({ initial: dialogInitial(series, !asCopy), open: true }))
      .catch((reason: unknown) => {
        toDialog.current = false
        toast.error(errorMessage(reason))
        refocus()
      })
  }
  const moreOptions = (input: CalendarEventInput) => {
    toDialog.current = true
    closeQuick()
    setDialog({ initial: input, open: true })
  }
  const saveDialog = (input: CalendarEventInput | CalendarEventChanges, id?: number) =>
    id != null ? calendar.updateEvent(id, input) : calendar.createEvent(input as CalendarEventInput)
  const closeDialog = () => setDialog((current) => current && { ...current, open: false })

  const changeColor = (occurrence: Occurrence, pick: ColorPick) => {
    // A category's colour wins, so a plain swatch also clears the category.
    const changes = 'color_key' in pick ? { color_key: pick.color_key, category_id: null } : pick
    void calendar.updateEvent(occurrence.event_id, changes)
  }
  const createTaskSafely = async (input: TaskInput) => {
    try {
      await createTask(input)
      return true
    } catch {
      return false // The app banner already shows why.
    }
  }

  // Search: submit-only, since every search reads two years of events.
  const searchToken = useRef(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<{ query: string; results: Occurrence[] | null; error: string | null } | null>(null)

  const openSearch = () => {
    if (searchOpen) searchInput.current?.focus()
    else setSearchOpen(true)
  }
  const clearSearch = () => {
    searchToken.current += 1
    setSearchOpen(false)
    setQuery('')
    setSearch(null)
  }
  const submitSearch = () => {
    const q = query.trim()
    if (!q) return
    const token = ++searchToken.current
    setPopover(null)
    setSearch({ query: q, results: null, error: null })
    api.calendarSearch(q)
      .then((results) => { if (token === searchToken.current) setSearch({ query: q, results, error: null }) })
      .catch((reason: unknown) => {
        if (token === searchToken.current) setSearch({ query: q, results: [], error: errorMessage(reason) })
      })
  }

  /** Open a result on its day, with its popover on the block once the day has drawn it. */
  const openResult = (occurrence: Occurrence) => {
    clearSearch()
    navigate('day', startOfDay(new Date(occurrence.start)))
    const attempt = (left: number) => {
      const element = itemElement(occurrence.id)
      if (!element && left > 0) {
        window.setTimeout(() => attempt(left - 1), 100)
        return
      }
      element?.scrollIntoView({ block: 'center' })
      element?.focus({ preventScroll: true })
      origin.current = element
      const anchor = (element ?? toolbar.current)?.getBoundingClientRect() ?? new DOMRect()
      closeQuick()
      setPopover({ occurrence, anchor })
    }
    window.setTimeout(() => attempt(15), 50)
  }

  const keyboardAnchor = () => {
    const box = main.current?.getBoundingClientRect()
    return box ? new DOMRect(box.left + box.width / 2 - 1, box.top + 48, 2, 2) : new DOMRect()
  }

  // The page's shortcuts. The latest closure runs, so state is never stale.
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    const shortcut = resolveShortcut(event, isTyping(event.target))
    if (!shortcut) return
    // Dialogs, sheets and quick-create own their keys (Radix closes them on Esc).
    if (quickOpen || dialog?.open || slot || categoriesOpen || sheetOpen) return
    // Another app overlay (chat, capture, task) has focus. The event popover is ours.
    if (!popover && event.target instanceof Element
      && event.target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) return

    const showingResults = search != null
    switch (shortcut.type) {
      case 'escape':
        if (searchOpen || showingResults) clearSearch()
        return
      case 'search':
        event.preventDefault()
        openSearch()
        return
      case 'edit':
      case 'delete':
        if (!popover) return
        event.preventDefault()
        if (shortcut.type === 'edit') openDialog(popover.occurrence, false)
        else void calendar.deleteEvent(popover.occurrence)
        setPopover(null)
        return
    }
    event.preventDefault()
    if (showingResults) clearSearch()
    setPopover(null)
    switch (shortcut.type) {
      case 'view': navigate(shortcut.view, date); break
      case 'today': navigate(view, new Date()); break
      case 'step': navigate(view, step(view, date, shortcut.direction)); break
      case 'create': createHere(keyboardAnchor()); break
    }
  }
  const onKeyRef = useRef(onKey)
  useEffect(() => { onKeyRef.current = onKey })
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyRef.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  return {
    mobile, view, date, range, calendar, navigate, selected,
    panel: { open: mobile ? sheetOpen : panelOpen, toggle: togglePanel, sheetOpen, setSheetOpen },
    popover: popover && shownOccurrence ? { ...popover, occurrence: shownOccurrence } : null,
    quick, dialog, slot, categoriesOpen,
    search: {
      open: searchOpen, query, current: search,
      onOpen: openSearch, onQueryChange: setQuery, onSubmit: submitSearch, onClear: clearSearch,
    },
    on: {
      selectEvent, selectSlot, createDraft, createAllDay, createHere, openResult,
      closePopover: () => setPopover(null),
      closeQuick,
      closeSlot: () => setSlot(null),
      edit: (o: Occurrence) => openDialog(o, false),
      duplicate: (o: Occurrence) => openDialog(o, true),
      remove: (o: Occurrence) => void calendar.deleteEvent(o),
      changeColor, moreOptions, saveDialog, closeDialog, onCloseAutoFocus, onDialogCloseAutoFocus,
      createTask: createTaskSafely,
      setCategoriesOpen,
    },
  }
}
