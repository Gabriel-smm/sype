import { useNavigate } from 'react-router'

import { glanceHours, type DayPlan } from '@/lib/agenda'
import { ALARM, typeColor } from '@/lib/task-meta'
import {
  MINUTES_IN_DAY, expandRecurring, formatClock, hoursLabel, isSameDay, minutesSinceMidnight,
} from '@/lib/time'
import { cn } from '@/lib/utils'
import type { FixedBlock, ScheduleSlot } from '@/types/api'

const BODY_HEIGHT = 176

interface WeekGlanceProps {
  week: (DayPlan & { day: Date })[]
  slots: ScheduleSlot[]
  fixedBlocks: FixedBlock[]
  now: Date
}

/**
 * The coming week at a glance, today first: seven narrow columns drawn over the waking hours.
 * Solid fills are work, hatching is time you are busy, the blue line is now,
 * and a diamond over a day means something falls due. Titles live in the
 * tooltips so the picture stays quiet. Any day opens the full calendar.
 */
export function WeekGlance({ week, slots, fixedBlocks, now }: WeekGlanceProps) {
  const navigate = useNavigate()
  const days = week.map((entry) => entry.day)
  const { start, end } = glanceHours(slots, days)
  const rangeStart = start * 60
  const range = (end - start) * 60
  const busy = expandRecurring(fixedBlocks, days[0], 'fixed')

  // Clip a span to the drawn hours; null when it falls entirely outside them.
  const place = (from: number, to: number) => {
    const top = Math.max(from, rangeStart)
    const bottom = Math.min(to, rangeStart + range)
    if (bottom <= top) return null
    return { top: ((top - rangeStart) / range) * BODY_HEIGHT, height: ((bottom - top) / range) * BODY_HEIGHT }
  }

  const guides = [start, Math.round((start + end) / 2), end]

  return (
    <div className="flex gap-2">
      <div aria-hidden="true" className="relative w-7 shrink-0 text-[11px] text-white/30 tnum" style={{ marginTop: 56, height: BODY_HEIGHT }}>
        {guides.map((hour) => (
          <span key={hour} className="absolute right-0 -translate-y-1/2" style={{ top: ((hour - start) / (end - start)) * BODY_HEIGHT }}>
            {String(hour % 24).padStart(2, '0')}
          </span>
        ))}
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1 sm:gap-2">
        {week.map(({ day, minutes, due }, dayOffset) => {
          const today = isSameDay(day, now)
          const daySlots = slots.filter((slot) => isSameDay(new Date(slot.start_time), day))
          const label = day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => void navigate('/calendar')}
              aria-label={`${label}: ${minutes ? `${hoursLabel(minutes)} of work` : 'no work planned'}${due.length ? `, ${due.length} due` : ''}. Open the calendar.`}
              className="group min-w-0 rounded-md text-left focus-visible:outline-offset-4"
            >
              <span className="flex h-14 flex-col items-center justify-start leading-tight">
                <span className={cn('text-[11px]', today ? 'text-white/80' : 'text-white/40')}>
                  {day.toLocaleDateString([], { weekday: 'short' })}
                </span>
                <span className={cn('text-[13px] tnum', today ? 'font-semibold text-blue-400' : 'text-white/70')}>
                  {day.getDate()}
                </span>
                <span className="mt-1 flex h-2 items-center gap-1" title={due.map((task) => `${task.title} due`).join('\n') || undefined}>
                  {due.slice(0, 3).map((task) => (
                    <span key={task.id} className="size-1.5 rotate-45"
                          style={{ background: new Date(task.due_date) < now ? ALARM : 'rgb(255 255 255 / 0.75)' }} />
                  ))}
                </span>
              </span>

              <span
                className={cn('relative block overflow-hidden rounded-md border border-white/[0.06] transition-colors group-hover:border-white/20',
                  today ? 'bg-white/[0.06]' : 'bg-white/[0.02]')}
                style={{ height: BODY_HEIGHT }}
              >
                {busy.filter((span) => span.dayOffset === dayOffset).map((span) => {
                  const box = place(span.startMinute, span.endMinute)
                  return box && <span key={span.id} className="hatched absolute inset-x-0" style={box} />
                })}

                {daySlots.map((slot) => {
                  const from = new Date(slot.start_time)
                  const startMinute = minutesSinceMidnight(from)
                  const length = (new Date(slot.end_time).getTime() - from.getTime()) / 60000
                  const box = place(startMinute, Math.min(startMinute + length, MINUTES_IN_DAY))
                  if (!box) return null
                  return (
                    <span
                      key={slot.id}
                      title={`${formatClock(from)} ${slot.title}`}
                      className="absolute inset-x-[3px] rounded-[3px] border-l-2 bg-white/[0.16]"
                      style={{ top: box.top, height: Math.max(box.height, 3),
                               borderLeftColor: slot.overdue ? ALARM : typeColor(slot.task_type) }}
                    />
                  )
                })}

                {today && (() => {
                  const line = place(minutesSinceMidnight(now), minutesSinceMidnight(now) + 1)
                  return line && <span className="absolute inset-x-0 h-0.5 bg-blue-400" style={{ top: line.top }} />
                })()}
              </span>

              <span className={cn('mt-1.5 block text-center text-xs tnum', minutes ? 'text-white/60' : 'text-white/25')}>
                {minutes ? hoursLabel(minutes) : '–'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
