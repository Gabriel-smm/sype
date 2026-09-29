import { useState, type FormEvent, type MouseEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { DAY_NAMES, MINUTES_IN_DAY, expandRecurring, formatHhmm } from '@/lib/time'
import { errorMessage } from '@/lib/utils'
import type { Block, BlockInput, BlockKind } from '@/types/api'
import type { AddBlock } from '@/types/app'

const STRIP_HEIGHT = 200
const GUIDE_HOURS = [0, 6, 12, 18, 24]

// expandRecurring works against real dates; the strip is a generic week, so
// feed it a Monday and read back only the day offsets.
const GENERIC_MONDAY = new Date(2024, 0, 1)

interface Draft {
  label: string
  kind: BlockKind
  day_of_week: string
  start_time: string
  end_time: string
}

interface WeekStripProps {
  blocks: Block[]
  tint: string
  onAdd: AddBlock
  onDelete: (id: number) => void
  addLabel: string
  busy: boolean
}

/**
 * A week painted rather than typed. Both fixed blocks and productive hours are
 * weekly and recurring, so they are easier to reason about as bands on a week
 * than as rows in a table. Click a gap to add one there; click a band to remove
 * it. The list underneath carries the exact times and the keyboard path.
 */
export function WeekStrip({ blocks, tint, onAdd, onDelete, addLabel, busy }: WeekStripProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const spans = expandRecurring(blocks, GENERIC_MONDAY, 'strip')

  function startDraft(dayIndex: number, event: MouseEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const fraction = (event.clientY - bounds.top) / bounds.height
    const hour = Math.min(22, Math.max(0, Math.floor(fraction * 24)))
    setError(null)
    setDraft({
      label: '',
      kind: 'class',
      day_of_week: String(dayIndex),
      start_time: `${String(hour).padStart(2, '0')}:00`,
      end_time: `${String(hour + 2).padStart(2, '0')}:00`,
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    setError(null)
    try {
      const payload: BlockInput = {
        label: draft.label.trim(),
        day_of_week: draft.day_of_week === '' ? null : Number(draft.day_of_week),
        start_time: draft.start_time,
        end_time: draft.end_time,
      }
      if (onAdd.withKind) payload.kind = draft.kind
      await onAdd(payload)
      setDraft(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div>
      <div className="flex gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]">
        <div className="relative w-8 shrink-0 bg-black" style={{ height: STRIP_HEIGHT + 26 }}>
          <span className="sr-only">Time of day</span>
          {GUIDE_HOURS.slice(0, -1).map((hour) => (
            <span
              key={hour}
              aria-hidden="true"
              className="absolute right-1.5 text-[10px] text-faint tnum"
              style={{ top: 26 + (hour / 24) * STRIP_HEIGHT - 5 }}
            >
              {String(hour).padStart(2, '0')}
            </span>
          ))}
        </div>

        {DAY_NAMES.map((name, dayIndex) => (
          <div key={name} className="flex-1 bg-black">
            <div className="py-1.5 text-center text-[11px] text-faint">{name}</div>
            <button
              type="button"
              onClick={(event) => startDraft(dayIndex, event)}
              title={`Add on ${name}`}
              className="relative block w-full cursor-copy bg-white/[0.02] transition-colors hover:bg-white/[0.05]"
              style={{ height: STRIP_HEIGHT }}
            >
              {GUIDE_HOURS.slice(1, -1).map((hour) => (
                <span
                  key={hour}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-white/[0.06]"
                  style={{ top: (hour / 24) * STRIP_HEIGHT }}
                />
              ))}

              {spans
                .filter((span) => span.dayOffset === dayIndex)
                .map((span) => {
                  const spanTop = (span.startMinute / MINUTES_IN_DAY) * STRIP_HEIGHT
                  const spanHeight = ((span.endMinute - span.startMinute) / MINUTES_IN_DAY) * STRIP_HEIGHT
                  return (
                    <span
                      key={span.id}
                      role="button"
                      tabIndex={0}
                      title={`${span.label} ${formatHhmm(span.startMinute)}–${formatHhmm(span.endMinute)}. Click to remove.`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(span.block.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.stopPropagation()
                        event.preventDefault()
                        onDelete(span.block.id)
                      }}
                      className="absolute inset-x-[3px] overflow-hidden rounded-md px-1 text-left text-[10px]
                                 leading-tight transition-opacity hover:opacity-60"
                      style={{
                        top: spanTop,
                        height: Math.max(spanHeight, 4),
                        background: `color-mix(in oklab, ${tint} 24%, transparent)`,
                        borderLeft: `2px solid ${tint}`,
                        color: tint,
                      }}
                    >
                      {spanHeight > 14 ? span.label : ''}
                    </span>
                  )
                })}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[13px] text-faint">
        Click anywhere empty to add {addLabel}. Click a band to remove it.
      </p>

      {draft && (
        <form
          onSubmit={submit}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        >
          <label className="min-w-[140px] flex-1">
            <Label>Name</Label>
            <Input
              autoFocus
              placeholder={onAdd.withKind ? 'Lecture' : 'Morning focus'}
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            />
          </label>

          {onAdd.withKind && (
            <label>
              <Label>Kind</Label>
              <NativeSelect
                value={draft.kind}
                onChange={(event) => setDraft({ ...draft, kind: event.target.value as BlockKind })}
              >
                <option value="class">Class</option>
                <option value="sleep">Sleep</option>
                <option value="lunch">Meals</option>
                <option value="other">Other</option>
              </NativeSelect>
            </label>
          )}

          <label>
            <Label>Day</Label>
            <NativeSelect
              value={draft.day_of_week}
              onChange={(event) => setDraft({ ...draft, day_of_week: event.target.value })}
            >
              <option value="">Every day</option>
              {DAY_NAMES.map((name, index) => (
                <option key={name} value={index}>{name}</option>
              ))}
            </NativeSelect>
          </label>

          <label>
            <Label>From</Label>
            <Input type="time" className="tnum" value={draft.start_time}
                   onChange={(event) => setDraft({ ...draft, start_time: event.target.value })} />
          </label>

          <label>
            <Label>To</Label>
            <Input type="time" className="tnum" value={draft.end_time}
                   onChange={(event) => setDraft({ ...draft, end_time: event.target.value })} />
          </label>

          <Button type="submit" disabled={busy}>Add</Button>
          <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>

          {draft.end_time <= draft.start_time && (
            <p className="w-full text-[13px] text-type-routine">Ends before it starts, so this runs overnight.</p>
          )}
          {error && <p role="alert" className="w-full text-[13px] text-destructive">{error}</p>}
        </form>
      )}
    </div>
  )
}
