import type { ReactNode } from 'react'

import { hexFor } from '@/lib/colors'
import { isAllDayLike } from '@/lib/drag'
import { formatTimeRange } from '@/lib/time'
import type { Calendar, Occurrence } from '@/types/api'

interface SearchResultsProps {
  query: string
  /** Null while the search runs. */
  results: Occurrence[] | null
  error: string | null
  /** Results from hidden calendars are still listed, marked "Hidden calendar". */
  calendars: Calendar[]
  onSelect: (occurrence: Occurrence) => void
}

/** Search hits in place of the grid: date, time, colour dot and title per row. */
export function SearchResults({ query, results, error, calendars, onSelect }: SearchResultsProps) {
  const hidden = new Set(calendars.filter((c) => !c.visible).map((c) => c.id))
  if (error) return <Message>{error}</Message>
  if (!results) return <Message>Searching…</Message>
  if (results.length === 0) return <Message>No events match “{query}”</Message>

  return (
    <div className="h-full overflow-y-auto px-2 py-2 sm:px-4">
      <p className="px-2 pb-2 text-sm text-faint">
        {results.length === 1 ? '1 event' : `${results.length} events`} match “{query}”
      </p>
      <ul className="flex flex-col gap-0.5">
        {results.map((occurrence) => {
          const start = new Date(occurrence.start)
          const title = occurrence.title || '(No title)'
          const date = start.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
          const time = isAllDayLike(occurrence) ? 'All day' : formatTimeRange(start, new Date(occurrence.end))
          const hex = hexFor(occurrence.color_key)
          const fromHidden = hidden.has(occurrence.calendar_id)
          return (
            <li key={occurrence.id}>
              <button
                type="button"
                onClick={() => onSelect(occurrence)}
                aria-label={`${title}, ${date}, ${time}${fromHidden ? ', hidden calendar' : ''}`}
                className="flex min-h-10 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10
                           focus-visible:outline-offset-[-2px] max-sm:flex-wrap max-sm:gap-y-0.5"
              >
                <span className="w-32 shrink-0 tnum text-faint">{date}</span>
                <span className="w-28 shrink-0 tnum text-faint">{time}</span>
                <span className="flex min-w-0 items-center gap-2 max-sm:basis-full">
                  <span aria-hidden className="size-3 shrink-0 rounded-full"
                        style={occurrence.busy ? { background: hex } : { border: `2px solid ${hex}` }} />
                  <span className="min-w-0 truncate">{title}</span>
                  {fromHidden && <span className="shrink-0 text-xs text-faint">Hidden calendar</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Message({ children }: { children: ReactNode }) {
  return <p className="p-8 text-center text-sm text-faint">{children}</p>
}
