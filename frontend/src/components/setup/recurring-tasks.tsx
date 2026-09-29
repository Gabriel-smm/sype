import { X } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'

import { StressPicker } from '@/components/tasks/stress-picker'
import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { typeLabel } from '@/lib/task-meta'
import { DAY_NAMES } from '@/lib/time'
import { cn, errorMessage } from '@/lib/utils'
import type { RecurringTask } from '@/types/api'
import type { Actions } from '@/types/app'

interface Form {
  title: string
  task_type: string
  hours: string
  grade_weight: string
  stress_rating: number
  weekdays: number[]
  due_time: string
}

const EMPTY: Form = {
  title: '',
  task_type: 'routine',
  hours: '1',
  grade_weight: '0',
  stress_rating: 2,
  weekdays: [],
  due_time: '18:00',
}

interface RecurringTasksProps {
  recurringTasks: RecurringTask[]
  taskTypes: string[]
  busy: boolean
  actions: Actions
}

/**
 * Templates for the parts of the week that repeat every week (gym, laundry,
 * chores) rather than one-off deadline work. Each active template is rolled
 * forward into ordinary tasks by the backend; this form only edits the
 * template, never the individual occurrences it produces.
 */
export function RecurringTasks({ recurringTasks, taskTypes, busy, actions }: RecurringTasksProps) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof Form) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [field]: event.target.value })
  const hours = Number(form.hours)

  function toggleDay(day: number) {
    setForm((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((d) => d !== day)
        : [...current.weekdays, day].sort((a, b) => a - b),
    }))
  }

  async function submit(event: FormEvent) {
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
      setError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label className="col-span-2">
            <Label>What repeats</Label>
            <Input value={form.title} onChange={set('title')} placeholder="Gym, laundry, meal prep…" />
          </label>
          <label>
            <Label>Kind</Label>
            <NativeSelect value={form.task_type} onChange={set('task_type')}>
              {taskTypes.map((type) => (
                <option key={type} value={type}>{typeLabel(type)}</option>
              ))}
            </NativeSelect>
          </label>
          <label>
            <Label>Hours each time</Label>
            <Input type="number" min="0.25" step="0.25" className="tnum" value={form.hours} onChange={set('hours')} />
          </label>
          <label>
            <Label>Due by</Label>
            <Input type="time" className="tnum" value={form.due_time} onChange={set('due_time')} />
          </label>
          <label>
            <Label>% of grade</Label>
            <Input type="number" min="0" max="100" className="tnum" value={form.grade_weight} onChange={set('grade_weight')} />
          </label>
          <StressPicker className="col-span-2" value={form.stress_rating}
                        onChange={(level) => setForm({ ...form, stress_rating: level })} />
        </div>

        <fieldset className="mt-4">
          <legend className="mb-1.5 text-[13px] text-muted-foreground">Which days</legend>
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((name, day) => {
              const on = form.weekdays.includes(day)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={on}
                  className={cn('h-9 rounded-full border px-3.5 text-[13px] transition-colors',
                    on
                      ? 'border-primary bg-primary/20 text-foreground'
                      : 'border-white/10 text-faint hover:border-white/20 hover:text-muted-foreground')}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>Add routine</Button>
          {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
        </div>
      </form>

      {recurringTasks.length === 0 ? (
        <p className="text-sm text-faint">No routines yet.</p>
      ) : (
        <ul className="divide-y divide-white/[0.06] text-sm">
          {recurringTasks.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <Switch
                checked={item.active}
                onCheckedChange={(active) => void actions.updateRecurringTask(item.id, { active })}
                aria-label={item.active ? `Pause ${item.title}` : `Resume ${item.title}`}
              />
              <span className={cn('w-32 shrink-0 truncate', !item.active && 'text-faint')}>{item.title}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {item.weekdays.map((day) => DAY_NAMES[day]).join(' ')}
                <span className="text-faint tnum">, due {item.due_time}</span>
              </span>
              <button
                type="button"
                onClick={() => void actions.deleteRecurringTask(item.id)}
                aria-label={`Remove ${item.title}`}
                className="grid size-7 place-items-center rounded-full text-faint transition-colors
                           hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
