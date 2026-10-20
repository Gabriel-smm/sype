import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import {
  applyOptimisticMove, insertOccurrences, removeEvent, withoutCalendar,
} from '@/lib/calendar-state'
import { toApiDateTime } from '@/lib/time'
import { errorMessage } from '@/lib/utils'
import type {
  Calendar, CalendarEventChanges, CalendarEventInput, Category, CategoryChanges, CategoryInput,
  Occurrence,
} from '@/types/api'

const fail = (e: unknown) => { toast.error(errorMessage(e)) }

/**
 * Calendar data for a visible range: occurrences (hidden calendars filtered out),
 * calendars and categories, plus mutations. Moves and deletes are optimistic and
 * roll back with an error toast when the request fails. Create/update/category
 * mutations resolve to true on success so dialogs can stay open on failure.
 * `refreshKey` must be a primitive or otherwise stable value (it is an effect dependency).
 * `onCategoriesChanged` runs after a category is renamed, recoloured or deleted.
 */
export function useCalendar(
  range: { start: Date; end: Date },
  refreshKey: unknown,
  { onCategoriesChanged }: { onCategoriesChanged?: () => void } = {},
) {
  const [all, setAll] = useState<Occurrence[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)
  // Bumped by every optimistic mutation; a fetch started under an older value is discarded.
  const generation = useRef(0)
  const allRef = useRef<Occurrence[]>([])
  const calendarsRef = useRef<Calendar[]>([])
  useEffect(() => { allRef.current = all }, [all])
  useEffect(() => { calendarsRef.current = calendars }, [calendars])

  const from = toApiDateTime(range.start)
  const to = toApiDateTime(range.end)

  // Clear on a range change (not on a refetch) so a stale week never shows.
  const [rangeKey, setRangeKey] = useState(`${from}|${to}`)
  if (rangeKey !== `${from}|${to}`) {
    setRangeKey(`${from}|${to}`)
    setAll([])
    setError(null)
    setLoading(true)
  }

  useEffect(() => {
    let current = true
    const started = generation.current
    api.calendarEvents(from, to)
      .then((result) => {
        if (!current || started !== generation.current) return
        setAll(result)
        setError(null)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (!current) return
        setError(reason instanceof Error ? reason.message : 'Could not load events.')
        setLoading(false)
      })
    return () => { current = false }
  }, [from, to, refreshKey, reloads])

  const refetch = useCallback(() => setReloads((n) => n + 1), [])

  const loadCategories = useCallback(async () => {
    try { setCategories(await api.categories()) } catch (e) { toast.error(errorMessage(e)) }
  }, [])
  // Bumped by reloadCalendars() to fetch the calendar and category lists again.
  const [listReloads, setListReloads] = useState(0)
  useEffect(() => {
    let current = true
    Promise.all([api.calendars(), api.categories()])
      .then(([cals, cats]) => {
        if (!current) return
        setCalendars(cals)
        setCategories(cats)
      })
      .catch((e: unknown) => { if (current) toast.error(errorMessage(e)) })
    return () => { current = false }
  }, [listReloads])
  /** Fetch calendars and categories again (e.g. after a calendar is added or synced elsewhere), then the events. */
  const reloadCalendars = useCallback(() => {
    setListReloads((n) => n + 1)
    refetch()
  }, [refetch])

  const occurrences = useMemo(() => {
    const hidden = calendars.filter((c) => !c.visible).map((c) => c.id)
    return withoutCalendar(all, hidden)
  }, [all, calendars])

  // Every mutation: bump the generation (discarding fetches that started earlier),
  // then reconcile with the server once the request settles.
  const settle = useCallback(() => refetch(), [refetch])

  const createEvent = useCallback(async (input: CalendarEventInput): Promise<boolean> => {
    try {
      await api.createCalendarEvent(input)
      toast('Event created')
      refetch()
      return true
    } catch (e) { fail(e); return false }
  }, [refetch])

  const updateEvent = useCallback(async (eventId: number, changes: CalendarEventChanges): Promise<boolean> => {
    try {
      await api.updateCalendarEvent(eventId, changes)
      toast('Event updated')
      refetch()
      return true
    } catch (e) { fail(e); return false }
  }, [refetch])

  const moveEvent = useCallback(async (o: Occurrence, start: Date, end: Date): Promise<void> => {
    if (o.recurring) {
      toast("Repeating events can't be moved one at a time yet")
      return
    }
    const prevStart = new Date(o.start)
    const prevEnd = new Date(o.end)
    generation.current += 1
    setAll((list) => applyOptimisticMove(list, o.id, start, end))
    try {
      await api.updateCalendarEvent(o.event_id, { start: toApiDateTime(start), end: toApiDateTime(end) })
    } catch (e) {
      generation.current += 1
      setAll((list) => applyOptimisticMove(list, o.id, prevStart, prevEnd))
      fail(e)
      settle()
      return
    }
    settle()
    toast('Event moved', {
      action: {
        label: 'Undo',
        onClick: () => {
          generation.current += 1
          setAll((list) => applyOptimisticMove(list, o.id, prevStart, prevEnd))
          api.updateCalendarEvent(o.event_id, { start: o.start, end: o.end })
            .catch((e: unknown) => {
              generation.current += 1
              setAll((list) => applyOptimisticMove(list, o.id, start, end))
              fail(e)
            })
            .finally(settle)
        },
      },
    })
  }, [settle])

  const deleteEvent = useCallback(async (o: Occurrence): Promise<void> => {
    // Deleting removes the whole series, so every occurrence of the event goes.
    // The page confirms first when `o` repeats.
    const removed = allRef.current.filter((x) => x.event_id === o.event_id)
    generation.current += 1
    setAll((list) => removeEvent(list, o.event_id))
    try {
      await api.deleteCalendarEvent(o.event_id)
    } catch (e) {
      generation.current += 1
      setAll((list) => insertOccurrences(list, removed))
      fail(e)
      settle()
      return
    }
    settle()
    toast(o.recurring ? `Deleted every “${o.title || '(No title)'}”` : 'Event deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          api.restoreCalendarEvent(o.event_id).catch(fail).finally(settle)
        },
      },
    })
  }, [settle])

  const setCalendarVisible = useCallback(async (id: number, visible: boolean): Promise<void> => {
    const previous = calendarsRef.current.find((c) => c.id === id)?.visible ?? !visible
    setCalendars((list) => list.map((c) => (c.id === id ? { ...c, visible } : c)))
    try {
      await api.updateCalendar(id, { visible })
    } catch (e) {
      setCalendars((list) => list.map((c) => (c.id === id ? { ...c, visible: previous } : c)))
      fail(e)
    }
  }, [])

  const createCategory = useCallback(async (input: CategoryInput): Promise<boolean> => {
    try { await api.createCategory(input); await loadCategories(); return true } catch (e) { fail(e); return false }
  }, [loadCategories])
  // Task blocks take their colour from the schedule, so a category change also refreshes it.
  const categoriesChanged = useRef(onCategoriesChanged)
  useEffect(() => { categoriesChanged.current = onCategoriesChanged })
  const afterCategoryChange = useCallback(async () => {
    await loadCategories()
    refetch()
    categoriesChanged.current?.()
  }, [loadCategories, refetch])
  const updateCategory = useCallback(async (id: number, changes: CategoryChanges): Promise<boolean> => {
    try { await api.updateCategory(id, changes) } catch (e) { fail(e); return false }
    await afterCategoryChange()
    return true
  }, [afterCategoryChange])
  const deleteCategory = useCallback(async (id: number, reassignTo?: number): Promise<boolean> => {
    try { await api.deleteCategory(id, reassignTo) } catch (e) { fail(e); return false }
    await afterCategoryChange()
    return true
  }, [afterCategoryChange])

  return {
    occurrences, calendars, categories, loading, error, refetch,
    createEvent, updateEvent, moveEvent, deleteEvent, setCalendarVisible, reloadCalendars,
    createCategory, updateCategory, deleteCategory,
  }
}
