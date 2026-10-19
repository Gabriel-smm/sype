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
 */
export function useCalendar(range: { start: Date; end: Date }, refreshKey: unknown) {
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
  }, [])

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
    toast('Event deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          api.restoreCalendarEvent(o.event_id).catch(fail).finally(settle)
        },
      },
    })
  }, [settle])

  const duplicateEvent = useCallback(async (eventId: number): Promise<boolean> => {
    try {
      const e = await api.getCalendarEvent(eventId)
      await api.createCalendarEvent({
        calendar_id: e.calendar_id, title: e.title, description: e.description,
        location: e.location, start: e.start, end: e.end, all_day: e.all_day, busy: e.busy,
        kind: e.kind, category_id: e.category_id, color_key: e.color_key,
        recurrence: e.recurrence,
      })
      toast('Event created')
      refetch()
      return true
    } catch (e) { fail(e); return false }
  }, [refetch])

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
  const updateCategory = useCallback(async (id: number, changes: CategoryChanges): Promise<boolean> => {
    try { await api.updateCategory(id, changes); await loadCategories(); refetch(); return true } catch (e) { fail(e); return false }
  }, [loadCategories, refetch])
  const deleteCategory = useCallback(async (id: number, reassignTo?: number): Promise<boolean> => {
    try { await api.deleteCategory(id, reassignTo); await loadCategories(); refetch(); return true } catch (e) { fail(e); return false }
  }, [loadCategories, refetch])

  return {
    occurrences, calendars, categories, loading, error, refetch,
    createEvent, updateEvent, moveEvent, deleteEvent, duplicateEvent, setCalendarVisible,
    createCategory, updateCategory, deleteCategory,
  }
}
