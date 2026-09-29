import { CornerDownLeft } from 'lucide-react'
import { useRef, useState } from 'react'

import { Kbd } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { parseCapture } from '@/lib/parse-capture'
import { decompositionHint, STRESS_WORDS, typeColor, typeLabel } from '@/lib/task-meta'
import { hoursLabel } from '@/lib/time'
import { cn, errorMessage } from '@/lib/utils'
import type { Task, TaskInput } from '@/types/api'

import { StressPicker } from './stress-picker'

type Field = 'due_date' | 'estimated_duration' | 'task_type' | 'grade_weight' | 'stress_rating'
type Overrides = Partial<Pick<TaskInput, Field>>

function dueText(value: string) {
  const due = new Date(value)
  const day = due.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  const endOfDay = due.getHours() === 23 && due.getMinutes() === 59
  return endOfDay
    ? `${day}, end of day`
    : `${day}, ${due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

interface CaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskTypes: string[]
  busy: boolean
  onCreate: (task: TaskInput) => Promise<Task>
}

/**
 * Add a task in one line from anywhere: "HIST essay fri 5pm 4h 20%". What the
 * line was understood as is shown as chips; tapping one opens the field behind
 * it, and anything edited by hand stays put while typing continues.
 */
export function CaptureDialog({ open, onOpenChange, taskTypes, busy, onCreate }: CaptureDialogProps) {
  const [text, setText] = useState('')
  const [overrides, setOverrides] = useState<Overrides>({})
  const [details, setDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const fields = useRef<Partial<Record<Field, HTMLElement | null>>>({})

  const parsed = parseCapture(text)
  const task = { ...parsed, ...overrides }
  const guessed = (field: Field) => !(field in overrides) && !(field in parsed.matched)
  const override = <K extends Field>(field: K, value: Overrides[K]) =>
    setOverrides({ ...overrides, [field]: value })

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
      else onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); input.current?.focus() }}>
        <DialogTitle className="sr-only">Add a task</DialogTitle>
        <DialogDescription className="sr-only">
          Describe the task in one line. What was understood appears below as chips you can change.
        </DialogDescription>
        <form onSubmit={(event) => { event.preventDefault(); void submit(false) }}>
          <div className="flex items-center gap-3 px-6 pt-6 pb-4">
            <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-dashed"
                  style={{ borderColor: color }} />
            <input
              ref={input}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submit(event.shiftKey)
                }
              }}
              aria-label="What needs doing?"
              placeholder="What needs doing?"
              className="w-full bg-transparent text-xl font-medium tracking-tight outline-none placeholder:text-faint"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 px-6 pb-4">
            {chips.map(([field, label]) => {
              const soft = guessed(field)
              const tint = field === 'task_type' ? color : 'var(--accent-ink)'
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => reveal(field)}
                  title={soft ? 'Guessed. Tap to change.' : 'Tap to change'}
                  className={cn('rounded-full border px-3 py-1 text-xs tnum transition-colors',
                    soft && 'border-dashed border-white/20 text-faint hover:text-muted-foreground')}
                  style={soft ? undefined : {
                    borderColor: `color-mix(in oklab, ${tint} 45%, transparent)`,
                    background: `color-mix(in oklab, ${tint} 12%, transparent)`,
                    color: tint,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {!text && !details && (
            <p className="px-6 pb-4 text-sm text-faint">
              Try <span className="text-muted-foreground">“HIST essay fri 5pm 4h 20%”</span>. Add{' '}
              <span className="text-muted-foreground">!</span> or <span className="text-muted-foreground">!!</span>{' '}
              if it is stressing you out.
            </p>
          )}

          {details && (
            <div className="grid grid-cols-2 gap-4 border-t border-white/[0.08] px-6 pt-4 pb-2 sm:grid-cols-4">
              <label className="col-span-2">
                <Label>Due</Label>
                <Input
                  ref={(node) => { fields.current.due_date = node }}
                  type="datetime-local" className="tnum"
                  value={task.due_date.slice(0, 16)}
                  onChange={(event) => event.target.value
                    && override('due_date', `${event.target.value}:00`)}
                />
              </label>
              <label>
                <Label>Hours of work</Label>
                <Input
                  ref={(node) => { fields.current.estimated_duration = node }}
                  type="number" min="0.25" step="0.25" className="tnum"
                  value={Math.round((task.estimated_duration / 60) * 100) / 100}
                  onChange={(event) => override('estimated_duration', Number(event.target.value) * 60)}
                />
              </label>
              <label>
                <Label>% of grade</Label>
                <Input
                  ref={(node) => { fields.current.grade_weight = node }}
                  type="number" min="0" max="100" className="tnum"
                  value={task.grade_weight}
                  onChange={(event) => override('grade_weight', Number(event.target.value))}
                />
              </label>
              <label className="col-span-2">
                <Label>Kind</Label>
                <NativeSelect
                  ref={(node) => { fields.current.task_type = node }}
                  value={task.task_type}
                  onChange={(event) => override('task_type', event.target.value)}
                >
                  {taskTypes.map((type) => (
                    <option key={type} value={type}>{typeLabel(type)}</option>
                  ))}
                </NativeSelect>
              </label>
              <StressPicker
                className="col-span-2"
                value={task.stress_rating}
                onChange={(level) => override('stress_rating', level)}
                firstRef={(node) => { fields.current.stress_rating = node }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.08] px-6 py-4">
            <p className="min-w-0 flex-1 text-[13px] text-faint">
              {decompositionHint(task.task_type, task.estimated_duration / 60)}
            </p>
            <span className="hidden items-center gap-1 text-xs text-faint md:inline-flex">
              <Kbd>⇧</Kbd><Kbd><CornerDownLeft className="size-3" /></Kbd> add another
            </span>
            <Button type="submit" disabled={busy}>
              {busy ? 'Adding…' : 'Add task'}
            </Button>
          </div>

          {error && <p role="alert" className="px-6 pb-4 text-sm text-destructive">{error}</p>}
        </form>
      </DialogContent>
    </Dialog>
  )
}
