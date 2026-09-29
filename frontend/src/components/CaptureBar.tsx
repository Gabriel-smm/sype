import { useEffect, useRef, useState } from 'react'

import { parseCapture } from '../lib/parseCapture'
import { decompositionHint, typeColor, typeLabel } from '../lib/taskMeta'
import { hoursLabel } from '../lib/time'
import type { Task, TaskInput } from '../types/api'

type Field = 'due_date' | 'estimated_duration' | 'task_type' | 'grade_weight' | 'stress_rating'
type Overrides = Partial<Pick<TaskInput, Field>>

interface CaptureBarProps {
  open: boolean
  onClose: () => void
  taskTypes: string[]
  busy: boolean
  onCreate: (task: TaskInput) => Promise<Task>
}

const STRESS_WORDS = ['calm', 'easy', 'fine', 'tense', 'dreading it']

function dueText(value: string) {
  const due = new Date(value)
  const day = due.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  const endOfDay = due.getHours() === 23 && due.getMinutes() === 59
  return endOfDay
    ? `${day}, end of day`
    : `${day}, ${due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

/**
 * Add a task in one line from anywhere: "HIST essay fri 5pm 4h 20%". What the
 * line was understood as is shown as chips; tapping one opens the field behind
 * it, and anything edited by hand stays put while typing continues.
 */
export default function CaptureBar({ open, onClose, taskTypes, busy, onCreate }: CaptureBarProps) {
  const [text, setText] = useState('')
  const [overrides, setOverrides] = useState<Overrides>({})
  const [details, setDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const fields = useRef<Partial<Record<Field, HTMLElement | null>>>({})

  useEffect(() => {
    if (!open) return undefined
    input.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const parsed = parseCapture(text)
  const task = { ...parsed, ...overrides }
  const guessed = (field: Field) => !(field in overrides) && !(field in parsed.matched)

  const override = <K extends Field>(field: K, value: Overrides[K]) => setOverrides({ ...overrides, [field]: value })

  function reveal(field: Field) {
    setDetails(true)
    // Wait for the fields to render before focusing.
    requestAnimationFrame(() => fields.current[field]?.focus())
  }

  function reset() {
    setText('')
    setOverrides({})
    setDetails(false)
    setError(null)
  }

  async function submit(keepOpen: boolean) {
    setError(null)
    if (!task.title.trim()) return setError('Give it a name first.')
    if (!(task.estimated_duration > 0)) return setError('Estimated time has to be more than zero.')

    try {
      await onCreate({
        title: task.title.trim(),
        due_date: task.due_date,
        estimated_duration: Math.round(task.estimated_duration),
        task_type: task.task_type,
        grade_weight: Number(task.grade_weight) || 0,
        stress_rating: Number(task.stress_rating),
      })
      reset()
      if (keepOpen) input.current?.focus()
      else onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const color = typeColor(task.task_type)
  const chips: [Field, string][] = [
    ['task_type', typeLabel(task.task_type)],
    ['due_date', dueText(task.due_date)],
    ['estimated_duration', hoursLabel(task.estimated_duration)],
    ['grade_weight', task.grade_weight > 0 ? `${task.grade_weight}% of grade` : 'no grade'],
    ['stress_rating', STRESS_WORDS[task.stress_rating - 1]],
  ]

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-ink-950/60"
      />
      <form
        role="dialog"
        aria-label="Add a task"
        onSubmit={(event) => { event.preventDefault(); submit(false) }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-ink-700 bg-ink-900 shadow-2xl
                   md:inset-x-auto md:top-[14vh] md:bottom-auto md:left-1/2 md:w-[min(600px,92vw)]
                   md:-translate-x-1/2 md:rounded-2xl"
      >
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span aria-hidden="true" className="size-[18px] shrink-0 rounded-full border border-dashed"
                style={{ borderColor: color }} />
          <input
            ref={input}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit(event.shiftKey)
              }
            }}
            aria-label="What needs doing?"
            placeholder="What needs doing?"
            className="w-full bg-transparent font-display text-[19px] outline-none placeholder:text-chalk-faint"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {chips.map(([field, label]) => {
            const soft = guessed(field)
            const tint = field === 'task_type' ? color : 'var(--color-lamp)'
            return (
              <button
                key={field}
                type="button"
                onClick={() => reveal(field)}
                title={soft ? 'Guessed — tap to change' : 'Tap to change'}
                className={`rounded-full border px-2.5 py-0.5 text-[12px] tnum transition-colors ${
                  soft ? 'border-dashed border-ink-600 text-chalk-faint hover:text-chalk-dim' : ''
                }`}
                style={soft ? undefined : {
                  borderColor: `color-mix(in srgb, ${tint} 45%, transparent)`,
                  background: `color-mix(in srgb, ${tint} 12%, transparent)`,
                  color: tint,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {!text && !details && (
          <p className="px-4 pb-3 text-[12px] text-chalk-faint">
            Try <span className="text-chalk-dim">“HIST essay fri 5pm 4h 20%”</span> — add{' '}
            <span className="text-chalk-dim">!</span> or <span className="text-chalk-dim">!!</span>{' '}
            if it is stressing you out.
          </p>
        )}

        {details && (
          <div className="grid grid-cols-2 gap-3 border-t border-ink-800 px-4 pt-3 pb-1 sm:grid-cols-4">
            <label className="col-span-2">
              <span className="field-label">Due</span>
              <input
                ref={(node) => { fields.current.due_date = node }}
                type="datetime-local" className="field tnum"
                value={task.due_date.slice(0, 16)}
                onChange={(event) => event.target.value
                  && override('due_date', `${event.target.value}:00`)}
              />
            </label>
            <label>
              <span className="field-label">Hours of work</span>
              <input
                ref={(node) => { fields.current.estimated_duration = node }}
                type="number" min="0.25" step="0.25" className="field tnum"
                value={Math.round((task.estimated_duration / 60) * 100) / 100}
                onChange={(event) => override('estimated_duration', Number(event.target.value) * 60)}
              />
            </label>
            <label>
              <span className="field-label">Kind</span>
              <select
                ref={(node) => { fields.current.task_type = node }}
                className="field" value={task.task_type}
                onChange={(event) => override('task_type', event.target.value)}
              >
                {taskTypes.map((type) => (
                  <option key={type} value={type}>{typeLabel(type)}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">% of grade</span>
              <input
                ref={(node) => { fields.current.grade_weight = node }}
                type="number" min="0" max="100" className="field tnum"
                value={task.grade_weight}
                onChange={(event) => override('grade_weight', Number(event.target.value))}
              />
            </label>
            <fieldset className="col-span-2 sm:col-span-3">
              <legend className="field-label">
                How much is this weighing on you?{' '}
                <span className="text-chalk-dim">{STRESS_WORDS[task.stress_rating - 1]}</span>
              </legend>
              <div className="flex gap-1.5 pt-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    ref={level === 1 ? (node) => { fields.current.stress_rating = node } : undefined}
                    type="button"
                    aria-label={STRESS_WORDS[level - 1]}
                    aria-pressed={task.stress_rating === level}
                    onClick={() => override('stress_rating', level)}
                    className="size-6 rounded-full border transition-colors"
                    style={{
                      borderColor: level <= task.stress_rating
                        ? 'var(--color-alarm)' : 'var(--color-ink-600)',
                      background: level <= task.stress_rating
                        ? `color-mix(in srgb, var(--color-alarm) ${12 + level * 8}%, transparent)`
                        : 'transparent',
                    }}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-ink-800 px-4 py-3">
          <p className="min-w-0 flex-1 text-[12px] text-chalk-faint">
            {decompositionHint(task.task_type, task.estimated_duration / 60)}
          </p>
          <span className="hidden text-[11px] text-chalk-faint md:inline">
            ⇧⏎ add another
          </span>
          <button type="submit" className="btn-lamp" disabled={busy}>
            {busy ? 'Adding…' : <>Add<span className="max-md:hidden"> ⏎</span></>}
          </button>
        </div>

        {error && <p className="px-4 pb-3 text-[12px] text-alarm">{error}</p>}
      </form>
    </>
  )
}
