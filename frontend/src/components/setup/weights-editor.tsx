import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { api } from '@/lib/api'
import { dueLabel, typeColor } from '@/lib/task-meta'
import type { Weights, WeightsPreview } from '@/types/api'

const SLIDERS: [keyof Weights, string, string, string][] = [
  ['w_urgency', 'A deadline getting close', 'How hard a near deadline pulls work forward.', '#60a5fa'],
  ['w_grade', 'How much the grade rides on it', 'How much a heavy assessment outranks a light one.', '#9d8cff'],
  ['w_stress', 'How much it is weighing on you', 'How much your own stress rating counts.', '#f87171'],
  ['w_effort_gap', 'How much is still untouched', 'How much work you have not started outranks work already begun.', '#56d3b0'],
]

interface WeightsEditorProps {
  weights: Weights
  busy: boolean
  onSave: (weights: Weights) => Promise<unknown>
}

export function WeightsEditor({ weights, busy, onSave }: WeightsEditorProps) {
  const [draft, setDraft] = useState<Weights>(weights)
  const [preview, setPreview] = useState<WeightsPreview | null>(null)
  const [saved, setSaved] = useState(false)
  const [serverWeights, setServerWeights] = useState(weights)

  // Adopt fresh settings from the server during render rather than in an
  // effect, so the sliders never paint a stale position first.
  if (serverWeights !== weights) {
    setServerWeights(weights)
    setDraft(weights)
  }

  const dirty = SLIDERS.some(([key]) => draft[key] !== weights[key])
  const total = SLIDERS.reduce((sum, [key]) => sum + draft[key], 0)

  const asNumbers = useMemo<Weights>(() => ({
    w_urgency: draft.w_urgency,
    w_grade: draft.w_grade,
    w_stress: draft.w_stress,
    w_effort_gap: draft.w_effort_gap,
  }), [draft])

  // Rank with the server's own scoring rather than a copy of the formula here.
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      api.previewWeights(asNumbers, 3)
        .then((result) => live && setPreview(result))
        .catch(() => live && setPreview(null))
    }, 180)
    return () => { live = false; clearTimeout(timer) }
  }, [asNumbers])

  async function save() {
    await onSave(asNumbers)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,300px)]">
      <div className="space-y-6">
        <div>
          <div className="flex h-2 overflow-hidden rounded-full bg-white/10" role="img"
               aria-label="The mix of the four weights">
            {SLIDERS.map(([key, , , color]) => (
              <span key={key} className="transition-[width] duration-150"
                    style={{ width: `${total > 0 ? (draft[key] / total) * 100 : 25}%`, background: color }} />
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">Only the proportions matter. They do not have to add up to anything.</p>
        </div>

        {SLIDERS.map(([key, label, blurb, color]) => (
          <div key={key}>
            <div className="flex items-baseline gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
              <span className="text-[15px]">{label}</span>
              <span className="ml-auto text-sm text-muted-foreground tnum">{draft[key].toFixed(2)}</span>
            </div>
            <Slider
              className="mt-1"
              aria-label={label}
              color={color}
              min={0} max={1} step={0.05}
              value={[draft[key]]}
              onValueChange={([value]) => setDraft({ ...draft, [key]: value })}
            />
            <p className="text-[13px] text-faint">{blurb}</p>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void save()} disabled={busy || !dirty}>Save weights</Button>
          {saved && <span role="status" className="text-[13px] text-type-problem">Saved</span>}
          {!saved && dirty && (
            <span className="text-[13px] text-faint">Not saved yet. The calendar keeps the old ordering until you do.</span>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-[13px] text-muted-foreground">With these weights, you would work on</h3>
        {preview === null ? (
          <p className="mt-3 text-sm text-faint">Working it out…</p>
        ) : preview.ranked.length === 0 ? (
          <p className="mt-3 text-sm text-faint">Nothing yet. Add a task and this fills in.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {preview.ranked.map((item, index) => (
              <li key={`${item.task_id}-${item.subtask_id}`} className="flex gap-3 text-sm">
                <span className="w-3 shrink-0 text-faint tnum">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: typeColor(item.task_type) }} />
                    <span className="truncate">{item.title}</span>
                  </span>
                  <span className="block truncate text-xs text-faint">
                    {item.parent_title ? `${item.parent_title}, ` : ''}{dueLabel(item.due_date)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {preview && preview.total_pending > preview.ranked.length && (
          <p className="mt-3 text-xs text-faint">and {preview.total_pending - preview.ranked.length} more after that</p>
        )}
      </aside>
    </div>
  )
}
