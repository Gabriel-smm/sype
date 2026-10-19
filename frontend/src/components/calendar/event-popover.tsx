import { Copy, Pencil, Repeat, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { hexFor } from '@/lib/colors'
import type { Calendar, Category, ColorKey, Occurrence } from '@/types/api'
import { ColorCategoryPicker, type ColorPick } from './color-category-picker'

interface Props {
  anchor: DOMRect | null
  occurrence: Occurrence | null
  calendars: Calendar[]
  categories: Category[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onChangeColor: (pick: ColorPick) => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const fullDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const shortDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/** "Monday, 19 October · 09:00 – 10:15", with both dates when it spans days. */
function describeWhen(o: Pick<Occurrence, 'start' | 'end' | 'all_day'>): string {
  const start = new Date(o.start)
  const end = new Date(o.end)
  if (o.all_day) {
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)
    return last.getTime() > new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
      ? `${shortDay(start)} – ${shortDay(last)} · All day`
      : `${fullDay(start)} · All day`
  }
  if (start.toDateString() === end.toDateString()) {
    return `${fullDay(start)} · ${clock(start)} – ${clock(end)}`
  }
  return `${shortDay(start)} ${clock(start)} – ${shortDay(end)} ${clock(end)}`
}

export function EventPopover({
  anchor, occurrence, calendars, categories, onClose, onEdit, onDelete, onDuplicate, onChangeColor,
}: Props) {
  const open = anchor != null && occurrence != null
  return (
    <Popover open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      {anchor && (
        <PopoverAnchor asChild>
          <div
            aria-hidden
            className="pointer-events-none invisible fixed"
            style={{ left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height }}
          />
        </PopoverAnchor>
      )}
      <PopoverContent align="start" className="p-0" aria-label="Event details">
        {occurrence && (
          <EventDetails
            key={occurrence.id}
            occurrence={occurrence} calendars={calendars} categories={categories}
            onClose={onClose} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate}
            onChangeColor={onChangeColor}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

function EventDetails({
  occurrence, calendars, categories, onClose, onEdit, onDelete, onDuplicate, onChangeColor,
}: Omit<Props, 'anchor' | 'occurrence'> & { occurrence: Occurrence }) {
  const [picking, setPicking] = useState(false)
  const calendar = calendars.find((c) => c.id === occurrence.calendar_id)
  const category = categories.find((c) => c.id === occurrence.category_id)
  const hex = hexFor(occurrence.color_key)

  const run = (action: () => void) => () => { action(); onClose() }

  return (
    <div>
      <div className="flex items-center justify-end gap-0.5 px-2 pt-2">
        <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={run(onEdit)}><Pencil className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={run(onDelete)}><Trash2 className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Duplicate" onClick={run(onDuplicate)}><Copy className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}><X className="size-4" /></Button>
      </div>
      <div className="space-y-3 px-4 pt-1 pb-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label="Change colour"
            aria-expanded={picking}
            onClick={() => setPicking((p) => !p)}
            className="mt-1.5 size-4 shrink-0 rounded-[4px] outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            style={{ backgroundColor: hex }}
          />
          <div className="min-w-0">
            <h2 className="text-xl leading-snug wrap-break-word">{occurrence.title || '(No title)'}</h2>
            <p className="mt-0.5 text-sm text-sidebar-foreground/70">{describeWhen(occurrence)}</p>
            {occurrence.recurring && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-sidebar-foreground/70">
                <Repeat aria-hidden className="size-3.5" /> Repeats
              </p>
            )}
          </div>
        </div>
        {picking && (
          <ColorCategoryPicker
            value={{ color_key: occurrence.color_key as ColorKey, category_id: occurrence.category_id }}
            categories={categories}
            onPick={onChangeColor}
          />
        )}
        {occurrence.location && <p className="text-sm">{occurrence.location}</p>}
        {occurrence.description && (
          <p className="max-h-32 overflow-y-auto text-sm whitespace-pre-wrap text-sidebar-foreground/70">
            {occurrence.description}
          </p>
        )}
        <p className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
          {calendar && <span>{calendar.name}</span>}
          {category && (
            <span className="flex items-center gap-1.5">
              {calendar && '·'}
              <span className="size-2.5 rounded-full" style={{ backgroundColor: hexFor(category.color_key) }} />
              {category.name}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
