import { useState, type FormEvent, type MouseEvent } from 'react'

import { DAY_NAMES, MINUTES_IN_DAY, expandRecurring, formatHhmm } from '../lib/time'
import type { Block, BlockInput, BlockKind } from '../types/api'
import type { AddBlock } from '../types/app'

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

const STRIP_HEIGHT = 200
const GUIDE_HOURS = [0, 6, 12, 18, 24]

// expandRecurring works against real dates; the strip is a generic week, so
// feed it a Monday and read back only the day offsets.
const GENERIC_MONDAY = new Date(2024, 0, 1)

/**
 * A week painted rather than typed. Both fixed blocks and productive hours are
 * weekly and recurring, so they are easier to reason about as bands on a week
 * than as rows in a table. Click a gap to add one there; click a band to remove
 * it. The list underneath carries the exact times and the keyboard path.
 */
export default function WeekStrip({ blocks, tint, onAdd, onDelete, addLabel, busy }: WeekStripProps) {
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
      setError((err as Error).message)
    }
  }

  return (
    <div>
      <div className="flex gap-px overflow-hidden rounded-lg border border-ink-700 bg-ink-700">
        <div className="relative w-7 shrink-0 bg-ink-900" style={{ height: STRIP_HEIGHT + 22 }}>
          <span className="sr-only">Time of day</span>
          {GUIDE_HOURS.slice(0, -1).map((hour) => (
            <span
              key={hour}
              aria-hidden="true"
              className="absolute right-1 text-[9px] text-chalk-faint tnum"
              style={{ top: 22 + (hour / 24) * STRIP_HEIGHT - 4 }}
            >
              {String(hour).padStart(2, '0')}
            </span>
          ))}
        </div>

        {DAY_NAMES.map((name, dayIndex) => (
          <div key={name} className="flex-1 bg-ink-900">
            <div className="py-1 text-center text-[10px] text-chalk-faint">{name}</div>
            <button
              type="button"
              onClick={(event) => startDraft(dayIndex, event)}
              title={`Add on ${name}`}
              className="relative block w-full cursor-copy bg-ink-950/60 transition-colors hover:bg-ink-950"
              style={{ height: STRIP_HEIGHT }}
            >
              {GUIDE_HOURS.slice(1, -1).map((hour) => (
                <span
                  key={hour}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-ink-800"
                  style={{ top: (hour / 24) * STRIP_HEIGHT }}
                />
              ))}

              {spans
                .filter((span) => span.dayOffset === dayIndex)
                .map((span) => {
                  const top = (span.startMinute / MINUTES_IN_DAY) * STRIP_HEIGHT
                  const height = ((span.endMinute - span.startMinute) / MINUTES_IN_DAY) * STRIP_HEIGHT
                  return (
                    <span
                      key={span.id}
                      role="button"
                      tabIndex={0}
                      title={`${span.label} ${formatHhmm(span.startMinute)}–${formatHhmm(span.endMinute)} — click to remove`}
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
                      className="absolute inset-x-[2px] overflow-hidden rounded-[3px] px-1
                                 text-left text-[9px] leading-tight transition-opacity hover:opacity-70"
                      style={{
                        top,
                        height: Math.max(height, 4),
                        background: `color-mix(in srgb, ${tint} 26%, transparent)`,
                        borderLeft: `2px solid ${tint}`,
                        color: tint,
                      }}
                    >
                      {height > 14 ? span.label : ''}
                    </span>
                  )
                })}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[12px] text-chalk-faint">
        Click anywhere empty to add {addLabel}. Click a band to remove it.
      </p>

      {draft && (
        <form
          onSubmit={submit}
          className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-ink-700 bg-ink-850 p-3"
        >
          <label className="min-w-[130px] flex-1">
            <span className="field-label">Name</span>
            <input
              autoFocus
              className="field"
              placeholder={onAdd.withKind ? 'Lecture' : 'Morning focus'}
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            />
          </label>

          {onAdd.withKind && (
            <label>
              <span className="field-label">Kind</span>
              <select
                className="field"
                value={draft.kind}
                onChange={(event) => setDraft({ ...draft, kind: event.target.value as BlockKind })}
              >
                <option value="class">Class</option>
                <option value="sleep">Sleep</option>
                <option value="lunch">Meals</option>
                <option value="other">Other</option>
              </select>
            </label>
          )}

          <label>
            <span className="field-label">Day</span>
            <select
              className="field"
              value={draft.day_of_week}
              onChange={(event) => setDraft({ ...draft, day_of_week: event.target.value })}
            >
              <option value="">Every day</option>
              {DAY_NAMES.map((name, index) => (
                <option key={name} value={index}>{name}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="field-label">From</span>
            <input
              type="time"
              className="field tnum"
              value={draft.start_time}
              onChange={(event) => setDraft({ ...draft, start_time: event.target.value })}
            />
          </label>

          <label>
            <span className="field-label">To</span>
            <input
              type="time"
              className="field tnum"
              value={draft.end_time}
              onChange={(event) => setDraft({ ...draft, end_time: event.target.value })}
            />
          </label>

          <button type="submit" className="btn-lamp" disabled={busy}>Add</button>
          <button type="button" className="btn-quiet" onClick={() => setDraft(null)}>Cancel</button>

          {draft.end_time <= draft.start_time && (
            <p className="w-full text-[12px] text-lamp">
              Ends before it starts, so this runs overnight.
            </p>
          )}
          {error && <p className="w-full text-[12px] text-alarm">{error}</p>}
        </form>
      )}
    </div>
  )
}
