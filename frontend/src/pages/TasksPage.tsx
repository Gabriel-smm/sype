import { useState } from 'react'

import DueChip from '../components/DueChip'
import StressMeter from '../components/StressMeter'
import { hoursLabel } from '../lib/time'
import { BUCKET_HEADINGS, dueBucket, typeColor, typeLabel, type DueBucket } from '../lib/taskMeta'
import type { Task } from '../types/api'
import type { Actions } from '../types/app'

const ORDER: DueBucket[] = ['overdue', 'today', 'week', 'later']

type Filter = 'all' | 'coursework' | 'routines'

const FILTERS: [Filter, string, (task: Task) => boolean][] = [
  ['all', 'All', () => true],
  ['coursework', 'Coursework', (task) => task.recurring_task_id == null],
  ['routines', 'Routines', (task) => task.recurring_task_id != null],
]

interface TasksPageProps {
  tasks: Task[]
  busy: boolean
  actions: Actions
  onOpenTask: (taskId: number) => void
  onCapture: () => void
}

export default function TasksPage({ tasks, busy, actions, onOpenTask, onCapture }: TasksPageProps) {
  const [showDone, setShowDone] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [leaving, setLeaving] = useState(() => new Set<number>())

  const keep = FILTERS.find(([key]) => key === filter)![2]
  const pending = tasks.filter((task) => task.status === 'pending' && keep(task))
  const finished = tasks.filter((task) => task.status !== 'pending' && keep(task))

  const grouped = ORDER.map((bucket): [DueBucket, Task[]] => [
    bucket,
    pending
      .filter((task) => dueBucket(task.due_date) === bucket)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
  ]).filter(([, items]) => items.length)

  // Let the strike-through land before the row disappears.
  async function settle(id: number, action: () => Promise<unknown>) {
    setLeaving((current) => new Set(current).add(id))
    try {
      await action()
    } finally {
      setLeaving((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[24px] tracking-tight">Everything on your plate</h1>
          <p className="mt-1 text-[13px] text-chalk-dim">
            Tap a task to change it. The week rebuilds itself around every change.
          </p>
        </div>
        <button type="button" className="btn-lamp" onClick={onCapture}>Add a task</button>
      </header>

      <div role="tablist" aria-label="Show" className="mt-5 inline-flex rounded-lg border border-ink-800 p-0.5">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-md px-3 py-1 text-[12.5px] transition-colors ${
              filter === key ? 'bg-ink-800 text-chalk' : 'text-chalk-faint hover:text-chalk-dim'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!pending.length && (
        <p className="mt-10 text-center text-[14px] text-chalk-faint">
          {filter === 'all'
            ? 'Nothing on the list. Press n to add something and the week builds around it.'
            : 'Nothing here right now.'}
        </p>
      )}

      {grouped.map(([bucket, items]) => (
        <section key={bucket} className="mt-7">
          <h2
            className={`mb-1 text-[12px] ${bucket === 'overdue' ? 'text-alarm' : 'text-chalk-faint'}`}
          >
            {BUCKET_HEADINGS[bucket]}
          </h2>
          <ul>
            {items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                leaving={leaving.has(task.id)}
                busy={busy}
                onOpen={() => onOpenTask(task.id)}
                onComplete={() => settle(task.id, () => actions.completeTask(task.id))}
              />
            ))}
          </ul>
        </section>
      ))}

      {finished.length > 0 && (
        <section className="mt-10 border-t border-ink-800 pt-4">
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            aria-expanded={showDone}
            className="text-[12px] text-chalk-faint transition-colors hover:text-chalk-dim"
          >
            {showDone ? 'Hide' : 'Show'} {finished.length} finished
          </button>
          {showDone && (
            <ul className="mt-3 space-y-0.5">
              {finished.map((task) => (
                <li key={task.id}>
                  <button type="button" onClick={() => onOpenTask(task.id)}
                          className="flex w-full items-center gap-2.5 py-1 text-left text-[13px] text-chalk-faint
                                     hover:text-chalk-dim">
                    <Tick done />
                    <span className="line-through">{task.title}</span>
                    <span className="ml-auto">{task.status === 'skipped' ? 'skipped' : 'done'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

interface TaskRowProps {
  task: Task
  leaving: boolean
  busy: boolean
  onOpen: () => void
  onComplete: () => void
}

function TaskRow({ task, leaving, busy, onOpen, onComplete }: TaskRowProps) {
  const color = typeColor(task.task_type)
  const subtasks = task.subtasks ?? []
  const remaining = subtasks.filter((subtask) => subtask.status === 'pending').length

  return (
    <li
      className={`flex items-start gap-3 border-b border-ink-800/70 py-3 transition-opacity duration-200
                  last:border-0 ${leaving ? 'opacity-30' : ''}`}
    >
      <button
        type="button"
        onClick={onComplete}
        disabled={busy}
        aria-label={`Mark ${task.title} done`}
        className="mt-[3px] shrink-0 p-0.5"
      >
        <Tick color={color} />
      </button>

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex items-baseline gap-2">
          <span className={`font-display text-[17px] leading-snug ${leaving ? 'line-through' : ''}`}>
            {task.title}
          </span>
          {task.grade_weight > 0 && (
            <span
              className="shrink-0 rounded px-1.5 py-px text-[11px] tnum"
              style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
            >
              {task.grade_weight}% of grade
            </span>
          )}
          {task.recurring_task_id != null && (
            <span aria-label="Repeats weekly" title="Repeats weekly" className="shrink-0 text-chalk-faint">
              <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor"
                   strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6.5A5 5 0 0111.5 4.3M12 2v2.5H9.5" />
                <path d="M12 7.5a5 5 0 01-9.5 2.2M2 12v-2.5h2.5" />
              </svg>
            </span>
          )}
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <DueChip due={task.due_date} />
          <EffortBar minutes={task.estimated_duration} invested={task.time_invested} color={color} />
          <StressMeter value={task.stress_rating} />
          <span className="text-[11px] text-chalk-faint">{typeLabel(task.task_type)}</span>
          {subtasks.length > 0 && (
            <span className="text-[11px] text-chalk-faint">
              {remaining === 0 ? 'all steps done' : `${remaining} of ${subtasks.length} steps left`}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

function Tick(
  { done = false, small = false, color = 'var(--color-chalk-faint)' }:
    { done?: boolean; small?: boolean; color?: string },
) {
  const size = small ? 13 : 18
  return (
    <span
      className="grid place-items-center rounded-full border transition-colors"
      style={{
        width: size,
        height: size,
        borderColor: done ? color : 'var(--color-ink-600)',
        background: done ? `color-mix(in srgb, ${color} 22%, transparent)` : 'transparent',
      }}
    >
      {done && (
        <svg viewBox="0 0 12 12" width={small ? 8 : 10} height={small ? 8 : 10} fill="none"
             stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.3l2.4 2.4L9.5 3.6" />
        </svg>
      )}
    </span>
  )
}

/** How much work this is, and how much of it is already behind you. */
function EffortBar({ minutes, invested, color }: { minutes: number; invested: number; color: string }) {
  const progress = minutes > 0 ? Math.min(invested / minutes, 1) : 0
  // Six hours of work fills the bar; anything longer simply maxes it out.
  const weight = Math.min(minutes / 360, 1)

  return (
    <span
      className="flex items-center gap-1.5"
      title={invested > 0
        ? `${hoursLabel(minutes)} estimated, ${hoursLabel(invested)} already done`
        : `${hoursLabel(minutes)} of work`}
    >
      <span className="relative block h-[3px] w-10 overflow-hidden rounded-full bg-ink-700">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.max(weight * 100, 8)}%`, background: `color-mix(in srgb, ${color} 60%, transparent)` }}
        />
        {progress > 0 && (
          <span className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${progress * Math.max(weight * 100, 8)}%`, background: color }} />
        )}
      </span>
      <span className="text-[11px] text-chalk-faint tnum">{hoursLabel(minutes)}</span>
    </span>
  )
}
