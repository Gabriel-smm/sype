import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toApiDateTime, toLocalInputValue } from '@/lib/time'
import type {
  Calendar, CalendarEventChanges, CalendarEventInput, Category, ColorKey,
} from '@/types/api'
import { ColorCategoryPicker } from './color-category-picker'

export type EventDialogInitial = CalendarEventInput & { id?: number }

interface Props {
  open: boolean
  /** For edit and duplicate, pass the series row from api.getCalendarEvent (full description, series times, own category). */
  initial: EventDialogInitial
  calendars: Calendar[]
  categories: Category[]
  onOpenChange: (open: boolean) => void
  /** Resolve true when saved. On a PATCH, `input` holds only the changed fields. */
  onSave: (input: CalendarEventInput | CalendarEventChanges, id?: number) => Promise<boolean>
  /** Lets the page return focus to the block that opened this. */
  onCloseAutoFocus?: (event: Event) => void
}

export function EventDialog({ open, initial, calendars, categories, onOpenChange, onSave, onCloseAutoFocus }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:w-[min(520px,92vw)]" onCloseAutoFocus={onCloseAutoFocus}>
        {/* Unmounted while closed, so every open starts from `initial`. */}
        <EventForm
          initial={initial} calendars={calendars} categories={categories}
          onCancel={() => onOpenChange(false)} onSave={onSave}
        />
      </DialogContent>
    </Dialog>
  )
}

const datePart = (d: Date) => toLocalInputValue(d).slice(0, 10)
const timePart = (d: Date) => toLocalInputValue(d).slice(11, 16)

function parse(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = (time || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

function EventForm({
  initial, calendars, categories, onCancel, onSave,
}: Omit<Props, 'open' | 'onOpenChange' | 'onCloseAutoFocus'> & { onCancel: () => void }) {
  const start0 = new Date(initial.start)
  const end0 = new Date(initial.end)
  const allDay0 = initial.all_day ?? false
  // All-day ends are exclusive in the API, but people read "last day".
  const shownEnd0 = allDay0 ? new Date(end0.getFullYear(), end0.getMonth(), end0.getDate() - 1) : end0
  const busy0 = initial.busy ?? !allDay0

  const [title, setTitle] = useState(initial.title)
  const [allDay, setAllDay] = useState(allDay0)
  const [startDate, setStartDate] = useState(datePart(start0))
  const [startTime, setStartTime] = useState(timePart(start0))
  const [endDate, setEndDate] = useState(datePart(shownEnd0))
  const [endTime, setEndTime] = useState(timePart(end0))
  const [busy, setBusy] = useState(busy0)
  const [calendarId, setCalendarId] = useState<number | null>(
    initial.calendar_id ?? (calendars.find((c) => c.is_primary) ?? calendars[0])?.id ?? null,
  )
  const [colorKey, setColorKey] = useState<ColorKey | null>(initial.color_key ?? null)
  const [categoryId, setCategoryId] = useState<number | null>(initial.category_id ?? null)
  const [location, setLocation] = useState(initial.location ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [saving, setSaving] = useState(false)

  // Moving the start keeps the duration, as Google does.
  const shiftEnd = (nextDate: string, nextTime: string) => {
    if (!range || !nextDate || (!allDay && !nextTime)) return
    const nextStart = parse(nextDate, allDay ? '00:00' : nextTime)
    const lastEnd = allDay
      ? new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() - 1)
      : range.end
    const delta = nextStart.getTime() - range.start.getTime()
    const moved = new Date(lastEnd.getTime() + delta)
    if (allDay) {
      const dayShift = Math.round(delta / 86400000)
      const e = new Date(lastEnd.getFullYear(), lastEnd.getMonth(), lastEnd.getDate() + dayShift)
      setEndDate(datePart(e))
    } else {
      setEndDate(datePart(moved)); setEndTime(timePart(moved))
    }
  }
  const toggleAllDay = (next: boolean) => {
    setAllDay(next)
    if (!next && startDate) {
      setStartTime('09:00'); setEndTime('10:00'); setEndDate(startDate)
    }
  }

  const range = (() => {
    if (!startDate || !endDate) return null
    if (allDay) {
      const s = parse(startDate, '00:00')
      const last = parse(endDate, '00:00')
      return { start: s, end: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1) }
    }
    if (!startTime || !endTime) return null
    return { start: parse(startDate, startTime), end: parse(endDate, endTime) }
  })()
  const invalid = range == null || range.end.getTime() <= range.start.getTime()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (invalid || saving || !title.trim()) return
    const next: CalendarEventInput = {
      title: title.trim(),
      start: toApiDateTime(range.start),
      end: toApiDateTime(range.end),
      all_day: allDay,
      busy,
      location,
      description,
      ...(calendarId != null ? { calendar_id: calendarId } : {}),
    }
    if (categoryId != null) next.category_id = categoryId
    else if (colorKey != null) next.color_key = colorKey

    setSaving(true)
    try {
      let saved: boolean
      if (initial.id == null) {
        saved = await onSave(next)
      } else {
        const changes: CalendarEventChanges = {}
        if (next.title !== initial.title) changes.title = next.title
        if (next.start !== toApiDateTime(start0)) changes.start = next.start
        if (next.end !== toApiDateTime(end0)) changes.end = next.end
        if (allDay !== allDay0) changes.all_day = allDay
        if (busy !== busy0) changes.busy = busy
        if (location !== (initial.location ?? '')) changes.location = location
        if (description !== (initial.description ?? '')) changes.description = description
        if (calendarId != null && calendarId !== initial.calendar_id) changes.calendar_id = calendarId
        if (categoryId !== (initial.category_id ?? null)) {
          if (categoryId != null) changes.category_id = categoryId
          else changes.color_key = colorKey
        } else if (categoryId == null && colorKey !== (initial.color_key ?? null)) {
          changes.color_key = colorKey
        }
        saved = await onSave(changes, initial.id)
      }
      if (saved) onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <DialogTitle className="text-xl">{initial.id == null ? 'New event' : 'Edit event'}</DialogTitle>
      <DialogDescription className="sr-only">Event details</DialogDescription>

      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add title" aria-label="Title" />

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={allDay} onCheckedChange={(v) => toggleAllDay(v === true)} />
        All day
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <Label>Start date</Label>
          <Input type="date" value={startDate} onChange={(e) => { shiftEnd(e.target.value, startTime); setStartDate(e.target.value) }} />
        </label>
        {!allDay && (
          <label>
            <Label>Start time</Label>
            <Input type="time" value={startTime} onChange={(e) => { shiftEnd(startDate, e.target.value); setStartTime(e.target.value) }} />
          </label>
        )}
        <label>
          <Label>End date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        {!allDay && (
          <label>
            <Label>End time</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        )}
      </div>
      {!title.trim() && <p className="text-sm text-sidebar-foreground/60">Add a title</p>}
      {invalid && (
        <p role="alert" className="text-sm text-destructive">End time must be after the start time</p>
      )}

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="event-busy" className="text-sm">Show as busy</label>
        <Switch id="event-busy" checked={busy} onCheckedChange={setBusy} />
      </div>

      <label className="block">
        <Label>Calendar</Label>
        <NativeSelect value={calendarId ?? ''} onChange={(e) => setCalendarId(Number(e.target.value))}>
          {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
      </label>

      <div>
        <Label>Colour and category</Label>
        <ColorCategoryPicker
          value={{ color_key: colorKey, category_id: categoryId }}
          categories={categories}
          onPick={(pick) => {
            if ('category_id' in pick) setCategoryId(pick.category_id)
            else { setColorKey(pick.color_key); setCategoryId(null) }
          }}
        />
      </div>

      <label className="block">
        <Label>Location</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className="block">
        <Label>Description</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={invalid || saving || !title.trim()}>Save</Button>
      </div>
    </form>
  )
}
