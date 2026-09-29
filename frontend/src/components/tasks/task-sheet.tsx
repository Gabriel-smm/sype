import { useState, type ChangeEvent, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { decompositionHint, dueLabel, typeColor, typeLabel } from '@/lib/task-meta'
import { hoursLabel } from '@/lib/time'
import { cn, errorMessage } from '@/lib/utils'
import type { Task, TaskChanges } from '@/types/api'
import type { Actions } from '@/types/app'

import { StressPicker } from './stress-picker'

interface Draft {
  title: string
  due_date: string
  hours: string
  task_type: string
  grade_weight: string
  stress_rating: number
  invested: string
}

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

interface SheetProps {
  taskTypes: string[]
  busy: boolean
  actions: Actions
  onClose: () => void
}

/** Everything about one task, editable, in a side panel. */
export function TaskSheet({ task, taskTypes, busy, actions, onClose }: SheetProps & { task: Task | null }) {
  return (
    <Sheet open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      {task && (
        <SheetContent title={task.title} description={typeLabel(task.task_type)}>
          {/* Keyed so switching tasks starts from a fresh draft. */}
          <SheetBody key={task.id} task={task} taskTypes={taskTypes} busy={busy}
                     actions={actions} onClose={onClose} />
        </SheetContent>
      )}
    </Sheet>
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
      setError(errorMessage(err))
    }
  }

  const close = (action: () => Promise<unknown>) => async () => {
    await action()
    onClose()
  }

  return (
    <div className="space-y-7 text-sm">
      {!pending && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-muted-foreground">
          This task is {task.status === 'skipped' ? 'skipped' : 'finished'}.{' '}
          <button type="button" className="text-accent-ink hover:underline"
                  onClick={() => void actions.updateTask(task.id, { status: 'pending' })}>
            Put it back on the list
          </button>
        </p>
      )}

      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <Label>Name</Label>
          <Input value={draft.title} onChange={set('title')} />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2">
            <Label>Due</Label>
            <Input type="datetime-local" className="tnum" value={draft.due_date} onChange={set('due_date')} />
          </label>
          <label>
            <Label>Hours of work</Label>
            <Input type="number" min="0.25" step="0.25" className="tnum"
                   value={draft.hours} onChange={set('hours')} />
          </label>
          <label>
            <Label>Hours already done</Label>
            <Input type="number" min="0" step="0.25" className="tnum"
                   value={draft.invested} onChange={set('invested')}
                   disabled={subtasks.length > 0} />
          </label>
          {subtasks.length > 0 && (
            <p className="col-span-2 -mt-2 text-xs text-faint">
              Hours done updates by itself as steps are finished.
            </p>
          )}
          <label>
            <Label>Kind</Label>
            <NativeSelect value={draft.task_type} onChange={set('task_type')}>
              {taskTypes.map((type) => (
                <option key={type} value={type}>{typeLabel(type)}</option>
              ))}
            </NativeSelect>
          </label>
          <label>
            <Label>% of grade</Label>
            <Input type="number" min="0" max="100" className="tnum"
                   value={draft.grade_weight} onChange={set('grade_weight')} />
          </label>
          <StressPicker className="col-span-2" value={draft.stress_rating}
                        onChange={(level) => setDraft({ ...draft, stress_rating: level })} />
        </div>

        <p className="text-xs text-faint">{decompositionHint(draft.task_type, Number(draft.hours))}</p>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || !dirty}>Save changes</Button>
          {saved && <span role="status" className="text-[13px] text-type-problem">Saved. Week rebuilt.</span>}
        </div>
        {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
      </form>

      {subtasks.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] text-muted-foreground">Steps</h3>
          <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.03]">
            {subtasks.map((subtask) => {
              const done = subtask.status !== 'pending'
              return (
                <li key={subtask.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <span className="size-2 shrink-0 rounded-full"
                        style={{ background: done ? 'rgb(255 255 255 / 0.2)' : color }} />
                  <span className={cn('capitalize', done && 'text-faint line-through')}>
                    {subtask.phase || subtask.title}
                  </span>
                  <span className="text-faint tnum">{hoursLabel(subtask.estimated_duration)}</span>
                  <span className="ml-auto text-xs text-faint tnum">
                    {done ? subtask.status : dueLabel(subtask.due_by)}
                  </span>
                  {!done && (
                    <span className="flex gap-1">
                      <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs" disabled={busy}
                              onClick={() => void actions.completeSubtask(subtask.id)}>
                        Done
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" disabled={busy}
                              onClick={() => void actions.skipSubtask(subtask.id)}>
                        Skip
                      </Button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-5">
        {pending && (
          <>
            <Button variant="secondary" size="sm" disabled={busy}
                    onClick={close(() => actions.completeTask(task.id))}>
              Mark all done
            </Button>
            <Button variant="ghost" size="sm" disabled={busy}
                    onClick={close(() => actions.skipTask(task.id))}>
              Skip
            </Button>
          </>
        )}
        {confirmDelete ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[13px] text-destructive">Delete for good?</span>
            <Button variant="destructive" size="sm" disabled={busy}
                    onClick={close(() => actions.deleteTask(task.id))}>
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" className="ml-auto hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}
