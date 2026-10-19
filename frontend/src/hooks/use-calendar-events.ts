import { useEffect, useState } from 'react'

import { api, toApiDateTime } from '@/lib/api'
import type { Occurrence } from '@/types/api'

/**
 * The event occurrences between `start` and `end`. Refetches when either date
 * changes or `refreshKey` does (the calendar page passes the schedule, so a
 * rebuild also refreshes the busy time it was built around).
 */
export function useCalendarEvents(start: Date, end: Date, refreshKey: unknown) {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [error, setError] = useState<string | null>(null)

  const from = toApiDateTime(start)
  const to = toApiDateTime(end)

  useEffect(() => {
    let current = true
    api.calendarEvents(from, to)
      .then((result) => {
        if (!current) return
        setOccurrences(result)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (current) setError(reason instanceof Error ? reason.message : 'Could not load events.')
      })
    return () => { current = false }
  }, [from, to, refreshKey])

  return { occurrences, error }
}
