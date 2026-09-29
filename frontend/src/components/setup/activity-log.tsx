import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ActivityEvent } from '@/types/api'

const EVENT_COLORS: Record<string, string> = {
  completed: '#56d3b0',
  skipped: '#f87171',
  rescheduled: '#60a5fa',
  unschedulable: '#f2a65a',
  created: '#9ea6b8',
  scheduled: '#9ea6b8',
}

const EVENT_WORDS: Record<string, string> = {
  completed: 'finished',
  skipped: 'skipped',
  rescheduled: 'moved',
  unschedulable: 'could not be placed',
  created: 'added',
  scheduled: 'placed on the calendar',
}

export function ActivityLog({ events }: { events: ActivityEvent[] }) {
  const [open, setOpen] = useState(false)

  if (!events.length) {
    return <p className="text-sm text-faint">Nothing recorded yet.</p>
  }

  const shown = open ? events : events.slice(0, 6)

  return (
    <div>
      <ul className="space-y-2.5 text-sm">
        {shown.map((event) => {
          const color = EVENT_COLORS[event.event_type] ?? '#9ea6b8'
          return (
            <li key={event.id} className="flex items-baseline gap-2.5">
              <span className="size-1.5 shrink-0 -translate-y-px rounded-full" style={{ background: color }} />
              <span style={{ color }}>{EVENT_WORDS[event.event_type] ?? event.event_type}</span>
              <span className="text-muted-foreground">
                {event.subtask_id ? `step ${event.subtask_id}` : `task ${event.task_id ?? '–'}`}
              </span>
              <span className="ml-auto shrink-0 text-faint tnum">
                {new Date(`${event.timestamp}Z`).toLocaleString([], {
                  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </li>
          )
        })}
      </ul>
      {events.length > 6 && (
        <Button variant="link" size="sm" className="mt-3" onClick={() => setOpen(!open)}>
          {open ? 'Show fewer' : `Show all ${events.length}`}
        </Button>
      )}
    </div>
  )
}
