import { useState } from 'react'

import { DAY_NAMES } from '../../lib/time'
import { typeLabel } from '../../lib/taskMeta'

const EMPTY = {
  title: '',
  task_type: 'routine',
  hours: '1',
  grade_weight: '0',
  stress_rating: 2,
  weekdays: [],
  due_time: '18:00',
}

/**
 * Templates for the parts of the week that repeat every week — gym, laundry,
 * chores — rather than one-off deadline work. Each active template is rolled
 * forward into ordinary tasks by the backend; this form only edits the
 * template, never the individual occurrences it produces.
 */
export default function RecurringTasks({ recurringTasks, taskTypes, busy, actions }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value })
  const hours = Number(form.hours)

  function toggleDay(day) {
    setForm((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((d) => d !== day)
        : [...current.weekdays, day].sort(),
    }))
  }

  async function submit(event) {
    event.preventDefault()
    setError(null)

    if (!form.title.trim()) return setError('Give it a name first.')
    if (!(hours > 0)) return setError('Estimated time has to be more than zero.')
    if (!form.weekdays.length) return setError('Pick at least one day.')

    try {
      await actions.createRecurringTask({
        title: form.title.trim(),
        task_type: form.task_type,
        estimated_duration: Math.round(hours * 60),
        grade_weight: Number(form.grade_weight) || 0,
        stress_rating: Number(form.stress_rating),
        weekdays: form.weekdays,
        due_time: form.due_time,
      })
      setForm(EMPTY)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="rounded-xl border border-ink-800 bg-ink-900 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="col-span-2 sm:col-span-2">
            <span className="field-label">What repeats</span>
            <input
              value={form.title}
              onChange={set('title')}
              placeholder="Gym, laundry, meal prep…"
              className="field"
            />
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
            <span className="field-label">Hours each time</span>
            <input type="number" min="0.25" step="0.25" className="field tnum"
                   value={form.hours} onChange={set('hours')} />
          </label>

          <label>
            <span className="field-label">Due by</span>
            <input type="time" className="field tnum" value={form.due_time} onChange={set('due_time')} />
          </label>

          <label>
            <span className="field-label">Worth (0 if not graded)</span>
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

        <div className="mt-3">
          <span className="field-label">Which days</span>
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((name, day) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={form.weekdays.includes(day)}
                className={`rounded-md border px-2.5 py-1 text-[12.5px] transition-colors ${
                  form.weekdays.includes(day)
                    ? 'border-lamp bg-lamp/15 text-lamp'
                    : 'border-ink-700 text-chalk-faint hover:text-chalk-dim'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-lamp" disabled={busy}>Add routine</button>
          {error && <p className="text-[12px] text-alarm">{error}</p>}
        </div>
      </form>

      <RecurringTaskList recurringTasks={recurringTasks} actions={actions} />
    </div>
  )
}

function RecurringTaskList({ recurringTasks, actions }) {
  if (!recurringTasks.length) {
    return <p className="mt-3 text-[13px] text-chalk-faint">Nothing set yet.</p>
  }

  return (
    <ul className="mt-3 divide-y divide-ink-800 text-[13px]">
      {recurringTasks.map((item) => (
        <li key={item.id} className={`group flex items-center gap-3 py-2 ${item.active ? '' : 'opacity-50'}`}>
          <span className="w-32 shrink-0 truncate">{item.title}</span>
          <span className="w-32 shrink-0 text-chalk-dim">
            {item.weekdays.map((day) => DAY_NAMES[day]).join(' ')}
          </span>
          <span className="text-chalk-dim tnum">due {item.due_time}</span>
          <button
            type="button"
            onClick={() => actions.updateRecurringTask(item.id, { active: !item.active })}
            className="ml-auto text-[12px] text-chalk-faint transition-colors hover:text-chalk-dim"
          >
            {item.active ? 'Pause' : 'Resume'}
          </button>
          <button
            type="button"
            onClick={() => actions.deleteRecurringTask(item.id)}
            className="text-[12px] text-chalk-faint transition-colors hover:text-alarm"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}
