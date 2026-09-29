import { useState, type ChangeEvent, type FormEvent } from 'react'

import Drawer from './Drawer'
import { decompositionHint, dueLabel, typeColor, typeLabel } from '../lib/taskMeta'
import { hoursLabel } from '../lib/time'
import type { Task, TaskChanges } from '../types/api'
import type { Actions } from '../types/app'

interface Draft {
  title: string
  due_date: string
  hours: string
  task_type: string
  grade_weight: string
  stress_rating: number
  invested: string
}

interface SheetProps {
  taskTypes: string[]
  busy: boolean
  actions: Actions
  onClose: () => void
}

const STRESS_WORDS = ['calm', 'easy', 'fine', 'tense', 'dreading it']

function draftOf(task: Task): Draft {
  return {
    title: task.title,
    due_date: task.due_date.slice(0, 16),
    hours: String(Math.round((task.estimated_duration / 60) * 100) / 100),
    task_type: task.task_type,
    grade_weight: String(task.grade_weight),
    stress_rating: task.stress_rating,
    invested: String(Math.round((task.time_invested / 60) * 100) / 100),
  }
}

/** Everything about one task, editable, in a side panel. */
export default function TaskSheet(
  { task, taskTypes, busy, actions, onClose }: SheetProps & { task: Task | null },
) {
  return (
    <Drawer open={Boolean(task)} title={task?.title ?? ''} onClose={onClose} width={400}>
      {/* Keyed so switching tasks starts from a fresh draft. */}
      {task && <SheetBody key={task.id} task={task} taskTypes={taskTypes} busy={busy}
                          actions={actions} onClose={onClose} />}
    </Drawer>
  )
}

function SheetBody({ task, taskTypes, busy, actions, onClose }: SheetProps & { task: Task }) {
  const [draft, setDraft] = useState(() => draftOf(task))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const set = (field: keyof Draft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft({ ...draft, [field]: event.target.value })
  const subtasks = task.subtasks ?? []
  const color = typeColor(task.task_type)
  const pending = task.status === 'pending'

  const original = draftOf(task)
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((key) => String(draft[key]) !== String(original[key]))

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const hours = Number(draft.hours)
    if (!draft.title.trim()) return setError('Give it a name first.')
    if (!(hours > 0)) return setError('Estimated time has to be more than zero.')

    const next: TaskChanges = {
      title: draft.title.trim(),
      due_date: `${draft.due_date}:00`,
      estimated_duration: Math.round(hours * 60),
      task_type: draft.task_type,
      grade_weight: Number(draft.grade_weight) || 0,
      stress_rating: Number(draft.stress_rating),
      time_invested: Math.round((Number(draft.invested) || 0) * 60),
    }
    // Send only what moved, so an untouched due date does not re-split the task.
    const changes = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => value !== task[key as keyof Task]),
    ) as TaskChanges
    try {
      await actions.updateTask(task.id, changes)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const close = (action: () => Promise<unknown>) => async () => {
    await action()
    onClose()
  }

  return (
    <div className="space-y-6 text-[13px]">
      {!pending && (
        <p className="rounded-lg bg-ink-800 px-3 py-2 text-chalk-dim">
          This task is {task.status === 'skipped' ? 'skipped' : 'finished'}.{' '}
          <button type="button" className="text-lamp hover:underline"
                  onClick={() => actions.updateTask(task.id, { status: 'pending' })}>
            Put it back on the list
          </button>
        </p>
      )}

      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="field-label">Name</span>
          <input className="field" value={draft.title} onChange={set('title')} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2">
            <span className="field-label">Due</span>
            <input type="datetime-local" className="field tnum" value={draft.due_date}
                   onChange={set('due_date')} />
          </label>
          <label>
            <span className="field-label">Hours of work</span>
            <input type="number" min="0.25" step="0.25" className="field tnum"
                   value={draft.hours} onChange={set('hours')} />
          </label>
          <label>
            <span className="field-label">Hours already done</span>
            <input type="number" min="0" step="0.25" className="field tnum"
                   value={draft.invested} onChange={set('invested')}
                   disabled={subtasks.length > 0} />
          </label>
          {subtasks.length > 0 && (
            <p className="col-span-2 -mt-1 text-[11.5px] text-chalk-faint">
              Hours done updates by itself as steps are finished.
            </p>
          )}
          <label>
            <span className="field-label">Kind</span>
            <select className="field" value={draft.task_type} onChange={set('task_type')}>
              {taskTypes.map((type) => (
                <option key={type} value={type}>{typeLabel(type)}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">% of grade</span>
            <input type="number" min="0" max="100" className="field tnum"
                   value={draft.grade_weight} onChange={set('grade_weight')} />
          </label>
          <label className="col-span-2">
            <span className="field-label">
              How much is this weighing on you?{' '}
              <span className="text-chalk-dim">{STRESS_WORDS[draft.stress_rating - 1]}</span>
            </span>
            <input type="range" min="1" max="5" className="slider-lamp"
                   value={draft.stress_rating}
                   onChange={(event) => setDraft({ ...draft, stress_rating: Number(event.target.value) })} />
          </label>
        </div>

        <p className="text-[11.5px] text-chalk-faint">
          {decompositionHint(draft.task_type, Number(draft.hours))}
        </p>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-lamp" disabled={busy || !dirty}>
            Save changes
          </button>
          {saved && <span className="text-[12.5px] text-type-problem">Saved — week rebuilt</span>}
        </div>
        {error && <p className="text-[12px] text-alarm">{error}</p>}
      </form>

      {subtasks.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] text-chalk-faint">Steps</h3>
          <ul className="space-y-1">
            {subtasks.map((subtask) => {
              const done = subtask.status !== 'pending'
              return (
                <li key={subtask.id} className="flex items-center gap-2.5 py-1">
                  <span className="size-1.5 shrink-0 rounded-full"
                        style={{ background: done ? 'var(--color-ink-600)' : color }} />
                  <span className={`capitalize ${done ? 'text-chalk-faint line-through' : ''}`}>
                    {subtask.phase || subtask.title}
                  </span>
                  <span className="text-chalk-faint tnum">{hoursLabel(subtask.estimated_duration)}</span>
                  <span className="ml-auto text-[11.5px] text-chalk-faint tnum">
                    {done ? subtask.status : dueLabel(subtask.due_by)}
                  </span>
                  {!done && (
                    <span className="flex gap-1">
                      <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[11.5px]"
                              disabled={busy} onClick={() => actions.completeSubtask(subtask.id)}>
                        Done
                      </button>
                      <button type="button" className="btn-quiet !px-2 !py-0.5 !text-[11.5px]"
                              disabled={busy} onClick={() => actions.skipSubtask(subtask.id)}>
                        Skip
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-800 pt-4">
        {pending && (
          <>
            <button type="button" className="btn-quiet" disabled={busy}
                    onClick={close(() => actions.completeTask(task.id))}>
              Mark all done
            </button>
            <button type="button" className="btn-quiet" disabled={busy}
                    onClick={close(() => actions.skipTask(task.id))}>
              Skip
            </button>
          </>
        )}
        {confirmDelete ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-alarm">Delete for good?</span>
            <button type="button" className="btn-quiet !border-alarm/50 !text-alarm" disabled={busy}
                    onClick={close(() => actions.deleteTask(task.id))}>
              Delete
            </button>
            <button type="button" className="btn-quiet" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className="ml-auto text-[12px] text-chalk-faint hover:text-alarm"
                  onClick={() => setConfirmDelete(true)}>
            Delete…
          </button>
        )}
      </div>
    </div>
  )
}
