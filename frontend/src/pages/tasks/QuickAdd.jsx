import { useState } from 'react'

import { toLocalInputValue } from '../../lib/time'
import { decompositionHint, typeLabel } from '../../lib/taskMeta'

function defaultDue() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  date.setHours(23, 59, 0, 0)
  return toLocalInputValue(date)
}

const EMPTY = {
  title: '',
  due_date: defaultDue(),
  hours: '2',
  task_type: 'other',
  grade_weight: '10',
  stress_rating: 3,
}

/**
 * One line to start with; the rest of the fields appear once there is something
 * to describe. Adding a task should not feel like filling in a form.
 */
export default function QuickAdd({ taskTypes, busy, onCreate }) {
  const [form, setForm] = useState(EMPTY)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value })
  const hours = Number(form.hours)

  async function submit(event) {
    event.preventDefault()
    setError(null)

    if (!form.title.trim()) return setError('Give it a name first.')
    if (!(hours > 0)) return setError('Estimated time has to be more than zero.')

    try {
      await onCreate({
        title: form.title.trim(),
        due_date: `${form.due_date}:00`,
        estimated_duration: Math.round(hours * 60),
        task_type: form.task_type,
        grade_weight: Number(form.grade_weight) || 0,
        stress_rating: Number(form.stress_rating),
      })
      setForm({ ...EMPTY, due_date: defaultDue() })
      setOpen(false)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form
      onSubmit={submit}
      className={`rounded-xl border bg-ink-900 transition-colors ${
        open ? 'border-ink-600' : 'border-ink-800'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span aria-hidden="true" className="size-[18px] shrink-0 rounded-full border border-dashed border-ink-600" />
        <input
          value={form.title}
          onChange={set('title')}
          onFocus={() => setOpen(true)}
          placeholder="What needs doing?"
          className="w-full bg-transparent font-display text-[17px] outline-none placeholder:text-chalk-faint"
        />
        {!open && form.title && (
          <button type="submit" className="btn-lamp shrink-0" disabled={busy}>Add</button>
        )}
      </div>

      {open && (
        <div className="border-t border-ink-800 px-4 pt-3 pb-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2">
              <span className="field-label">Due</span>
              <input type="datetime-local" className="field tnum" value={form.due_date}
                     onChange={set('due_date')} />
            </label>

            <label>
              <span className="field-label">Hours of work</span>
              <input type="number" min="0.25" step="0.25" className="field tnum"
                     value={form.hours} onChange={set('hours')} />
            </label>

            <label>
              <span className="field-label">Kind</span>
              <select className="field" value={form.task_type} onChange={set('task_type')}>
                {taskTypes.map((type) => (
                  <option key={type} value={type}>{typeLabel(type)}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="field-label">Worth (% of grade)</span>
              <input type="number" min="0" max="100" className="field tnum"
                     value={form.grade_weight} onChange={set('grade_weight')} />
            </label>

            <label className="col-span-2 sm:col-span-3">
              <span className="field-label">
                How much is this weighing on you?{' '}
                <span className="text-chalk-dim">
                  {['calm', 'easy', 'fine', 'tense', 'dreading it'][form.stress_rating - 1]}
                </span>
              </span>
              <input type="range" min="1" max="5" className="slider-lamp"
                     value={form.stress_rating} onChange={set('stress_rating')} />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-lamp" disabled={busy}>Add to the week</button>
            <button type="button" className="btn-quiet"
                    onClick={() => { setOpen(false); setError(null) }}>
              Cancel
            </button>
            <p className="text-[12px] text-chalk-faint">{decompositionHint(form.task_type, hours)}</p>
          </div>

          {error && <p className="mt-2 text-[12px] text-alarm">{error}</p>}
        </div>
      )}
    </form>
  )
}
