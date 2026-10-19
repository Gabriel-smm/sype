import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { applyOptimisticMove, removeOccurrence, withoutCalendar } from '@/lib/calendar-state'
import { toApiDateTime } from '@/lib/time'
import { errorMessage } from '@/lib/utils'
import type {
  Calendar, CalendarEventChanges, CalendarEventInput, Category, CategoryChanges, CategoryInput,
  Occurrence,
} from '@/types/api'

/**
 * Calendar data for a visible range: occurrences (hidden calendars filtered out),
 * calendars and categories, plus mutations. Moves and deletes are optimistic and
 * roll back with an error toast when the request fails.
 */
export function useCalendar(range: { start: Date; end: Date }, refreshKey: unknown) {
  const [all, setAll] = useState<Occurrence[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  const from = toApiDateTime(range.start)
  const to = toApiDateTime(range.end)

  // Clear on a range change (not on a refetch) so a stale week never shows.
  const [rangeKey, setRangeKey] = useState(`${from}|${to}`)
  if (rangeKey !== `${from}|${to}`) {
    setRangeKey(`${from}|${to}`)
    setAll([])
    setLoading(true)
  }

  useEffect(() => {
    let current = true
    api.calendarEvents(from, to)
      .then((result) => {
        if (!current) return
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

  const fail = (e: unknown) => { toast.error(errorMessage(e)) }

  const createEvent = useCallback(async (input: CalendarEventInput) => {
    try {
      await api.createCalendarEvent(input)
      toast('Event created')
      refetch()
    } catch (e) { fail(e) }
  }, [refetch])

  const updateEvent = useCallback(async (eventId: number, changes: CalendarEventChanges) => {
    try {
      await api.updateCalendarEvent(eventId, changes)
      toast('Event updated')
      refetch()
    } catch (e) { fail(e) }
  }, [refetch])

  const moveEvent = useCallback(async (o: Occurrence, start: Date, end: Date) => {
    if (o.recurring) {
      toast("Repeating events can't be moved one at a time yet")
      return
    }
    const prevStart = new Date(o.start)
    const prevEnd = new Date(o.end)
    setAll((list) => applyOptimisticMove(list, o.id, start, end))
    try {
      await api.updateCalendarEvent(o.event_id, { start: toApiDateTime(start), end: toApiDateTime(end) })
    } catch (e) {
      setAll((list) => applyOptimisticMove(list, o.id, prevStart, prevEnd))
      fail(e)
      return
    }
    toast('Event moved', {
      action: {
        label: 'Undo',
        onClick: () => {
          setAll((list) => applyOptimisticMove(list, o.id, prevStart, prevEnd))
          api.updateCalendarEvent(o.event_id, { start: o.start, end: o.end })
            .catch((e: unknown) => {
              setAll((list) => applyOptimisticMove(list, o.id, start, end))
              fail(e)
            })
        },
      },
    })
  }, [])

  const deleteEvent = useCallback(async (o: Occurrence) => {
    const snapshot = all
    setAll((list) => removeOccurrence(list, o.id))
    try {
      await api.deleteCalendarEvent(o.event_id)
    } catch (e) {
      setAll(snapshot)
      fail(e)
      return
    }
    toast('Event deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          api.restoreCalendarEvent(o.event_id)
            .then(refetch)
            .catch(fail)
        },
      },
    })
  }, [all, refetch])

  const duplicateEvent = useCallback(async (eventId: number) => {
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
    } catch (e) { fail(e) }
  }, [refetch])

  const setCalendarVisible = useCallback(async (id: number, visible: boolean) => {
    setCalendars((list) => list.map((c) => (c.id === id ? { ...c, visible } : c)))
    try {
      await api.updateCalendar(id, { visible })
    } catch (e) {
      setCalendars((list) => list.map((c) => (c.id === id ? { ...c, visible: !visible } : c)))
      fail(e)
    }
  }, [])

  const createCategory = useCallback(async (input: CategoryInput) => {
    try { await api.createCategory(input); await loadCategories() } catch (e) { fail(e) }
  }, [loadCategories])
  const updateCategory = useCallback(async (id: number, changes: CategoryChanges) => {
    try { await api.updateCategory(id, changes); await loadCategories(); refetch() } catch (e) { fail(e) }
  }, [loadCategories, refetch])
  const deleteCategory = useCallback(async (id: number, reassignTo?: number) => {
    try { await api.deleteCategory(id, reassignTo); await loadCategories(); refetch() } catch (e) { fail(e) }
  }, [loadCategories, refetch])

  return {
    occurrences, calendars, categories, loading, error, refetch,
    createEvent, updateEvent, moveEvent, deleteEvent, duplicateEvent, setCalendarVisible,
    createCategory, updateCategory, deleteCategory,
  }
}
