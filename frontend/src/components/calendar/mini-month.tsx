import { addMonths, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { monthGrid } from '@/lib/calendar-view'
import { isSameDay } from '@/lib/time'
import { cn } from '@/lib/utils'

interface MiniMonthProps {
  /** The date the calendar shows; the mini month follows it. */
  date: Date
  onSelect: (day: Date) => void
}

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth()

/** The side panel's month: 28px day circles, paged with its own arrows. */
export function MiniMonth({ date, onSelect }: MiniMonthProps) {
  const [shown, setShown] = useState(() => startOfMonth(date))
  // Follow the main calendar when it moves to another month.
  const [followed, setFollowed] = useState(monthKey(date))
  if (followed !== monthKey(date)) {
    setFollowed(monthKey(date))
    setShown(startOfMonth(date))
  }

  const weeks = monthGrid(shown)
  const today = new Date()
  const nav = 'grid size-7 place-items-center rounded-full text-faint hover:bg-white/10 hover:text-foreground'

  return (
    <div className="px-3">
      <div className="flex items-center justify-between pb-1 pl-2">
        <p className="text-sm font-medium">{shown.toLocaleDateString([], { month: 'long', year: 'numeric' })}</p>
        <div className="flex">
          <button type="button" aria-label="Previous month" className={nav}
                  onClick={() => setShown((m) => addMonths(m, -1))}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Next month" className={nav}
                  onClick={() => setShown((m) => addMonths(m, 1))}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 justify-items-center gap-y-0.5 text-[11px] tnum">
        {weeks[0].map((day) => (
          <span key={day.getDay()} aria-hidden className="grid size-7 place-items-center text-faint">
            {day.toLocaleDateString([], { weekday: 'narrow' })}
          </span>
        ))}
        {weeks.flat().map((day) => {
          const isToday = isSameDay(day, today)
          const selected = isSameDay(day, date)
          return (
            <button
              key={day.getTime()}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={selected}
              className={cn(
                'grid size-7 place-items-center rounded-full',
                day.getMonth() !== shown.getMonth() && 'text-faint',
                isToday
                  ? 'bg-primary text-primary-foreground'
                  : selected ? 'bg-primary/25 text-foreground' : 'hover:bg-white/10',
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
