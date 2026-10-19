import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toApiDateTime } from '@/lib/time'
import type { Calendar, CalendarEventInput, TaskInput } from '@/types/api'

export interface QuickCreateDraft {
  start: Date
  end: Date
  allDay: boolean
}

interface Props {
  anchor: DOMRect | null
  draft: QuickCreateDraft
  calendars: Calendar[]
  onClose: () => void
  onCreateEvent: (input: CalendarEventInput) => Promise<boolean>
  onCreateTask: (input: TaskInput) => Promise<unknown>
  onMoreOptions: (draft: CalendarEventInput) => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

function nextMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function eventInput(title: string, draft: QuickCreateDraft, calendars: Calendar[]): CalendarEventInput {
  const calendar = calendars.find((c) => c.is_primary) ?? calendars[0]
  const start = draft.allDay ? startOfDay(draft.start) : draft.start
  const end = draft.allDay ? nextMidnight(draft.start) : draft.end
  return {
    title,
    ...(calendar ? { calendar_id: calendar.id } : {}),
    start: toApiDateTime(start),
    end: toApiDateTime(end),
    all_day: draft.allDay,
  }
}

export function QuickCreatePopover({
  anchor, draft, calendars, onClose, onCreateEvent, onCreateTask, onMoreOptions,
}: Props) {
  return (
    <Popover open={anchor != null} onOpenChange={(open) => { if (!open) onClose() }}>
      {anchor && (
        <PopoverAnchor asChild>
          <div
            aria-hidden
            className="pointer-events-none invisible fixed"
            style={{ left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height }}
          />
        </PopoverAnchor>
      )}
      <PopoverContent align="start" className="p-0" aria-label="Create">
        {/* Remounted per draft so the typed title never leaks into the next one. */}
        <QuickCreateForm
          key={`${draft.start.getTime()}-${draft.end.getTime()}-${draft.allDay}`}
          draft={draft} calendars={calendars} onClose={onClose}
          onCreateEvent={onCreateEvent} onCreateTask={onCreateTask} onMoreOptions={onMoreOptions}
        />
      </PopoverContent>
    </Popover>
  )
}

function QuickCreateForm({
  draft, calendars, onClose, onCreateEvent, onCreateTask, onMoreOptions,
}: Omit<Props, 'anchor'>) {
  const [tab, setTab] = useState<'event' | 'task'>('event')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const when = draft.allDay
    ? `${dayLabel(draft.start)} · All day`
    : `${dayLabel(draft.start)} · ${clock(draft.start)} – ${clock(draft.end)}`
  const minutes = Math.round((draft.end.getTime() - draft.start.getTime()) / 60000)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      if (tab === 'event') {
        if (await onCreateEvent(eventInput(trimmed, draft, calendars))) onClose()
      } else {
        await onCreateTask({
          title: trimmed,
          task_type: 'other',
          grade_weight: 0,
          stress_rating: 3,
          estimated_duration: Math.max(15, minutes),
          due_date: toApiDateTime(draft.end),
        })
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'event' | 'task')}>
        <TabsList className="px-3">
          <TabsTrigger value="event">Event</TabsTrigger>
          <TabsTrigger value="task">Task</TabsTrigger>
        </TabsList>
        <div className="space-y-3 p-4">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            aria-label="Title"
          />
          <TabsContent value="event">
            <p className="text-sm text-sidebar-foreground/70">{when}</p>
          </TabsContent>
          <TabsContent value="task">
            <p className="text-sm text-sidebar-foreground/70">
              {dayLabel(draft.end)} · Due {clock(draft.end)}
            </p>
          </TabsContent>
          <div className="flex items-center justify-between pt-1">
            {tab === 'event' ? (
              <Button
                variant="ghost" size="sm"
                onClick={() => onMoreOptions({ ...eventInput(title.trim(), draft, calendars) })}
              >
                More options
              </Button>
            ) : <span />}
            <Button type="submit" disabled={!title.trim() || saving}>Save</Button>
          </div>
        </div>
      </Tabs>
    </form>
  )
}
