import { useState } from 'react'

import DueChip from '../components/DueChip'
import StressMeter from '../components/StressMeter'
import QuickAdd from './tasks/QuickAdd'
import { hoursLabel } from '../lib/time'
import {
  BUCKET_HEADINGS,
  dueBucket,
  dueLabel,
  typeColor,
  typeLabel,
} from '../lib/taskMeta'

const ORDER = ['overdue', 'today', 'week', 'later']

export default function TasksPage({ tasks, taskTypes, busy, actions }) {
  const [showDone, setShowDone] = useState(false)
  const [leaving, setLeaving] = useState(() => new Set())

  const pending = tasks.filter((task) => task.status === 'pending')
  const finished = tasks.filter((task) => task.status !== 'pending')

  const grouped = ORDER.map((bucket) => [
    bucket,
    pending
      .filter((task) => dueBucket(task.due_date) === bucket)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date)),
  ]).filter(([, items]) => items.length)

  // Let the strike-through land before the row disappears.
  async function settle(id, action) {
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
      <h1 className="font-display text-[24px] tracking-tight">Everything on your plate</h1>
      <p className="mt-1 mb-6 text-[13px] text-chalk-dim">
        Add what needs doing. The week rebuilds itself around it.
      </p>

      <QuickAdd taskTypes={taskTypes} busy={busy} onCreate={actions.createTask} />

      {!pending.length && (
        <p className="mt-10 text-center text-[14px] text-chalk-faint">
          Nothing on the list. Add something and the week builds around it.
        </p>
      )}

      {grouped.map(([bucket, items]) => (
        <section key={bucket} className="mt-8">
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
                leaving={leaving.has(`task-${task.id}`)}
                busy={busy}
                onComplete={() => settle(`task-${task.id}`, () => actions.completeTask(task.id))}
                onSkip={() => actions.skipTask(task.id)}
                onDelete={() => actions.deleteTask(task.id)}
                onCompleteSubtask={(id) =>
                  settle(`sub-${id}`, () => actions.completeSubtask(id))}
                onSkipSubtask={actions.skipSubtask}
                leavingSubtasks={leaving}
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
            <ul className="mt-3 space-y-1.5">
              {finished.map((task) => (
                <li key={task.id} className="flex items-center gap-2.5 text-[13px] text-chalk-faint">
                  <Tick done />
                  <span className="line-through">{task.title}</span>
                  <span className="ml-auto">{task.status === 'skipped' ? 'skipped' : 'done'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function TaskRow({
  task, leaving, busy, onComplete, onSkip, onDelete,
  onCompleteSubtask, onSkipSubtask, leavingSubtasks,
}) {
  const [open, setOpen] = useState(false)
  const color = typeColor(task.task_type)
  const subtasks = task.subtasks ?? []
  const remaining = subtasks.filter((subtask) => subtask.status === 'pending').length

  return (
    <li
      className={`group border-b border-ink-800/70 py-3 transition-opacity duration-200 last:border-0
                  ${leaving ? 'opacity-30' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onComplete}
          disabled={busy}
          aria-label={`Mark ${task.title} done`}
          className="mt-[3px] shrink-0"
        >
          <Tick color={color} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3
              className={`font-display text-[17px] leading-snug ${leaving ? 'line-through' : ''}`}
            >
              {task.title}
            </h3>
            {task.grade_weight > 0 && (
              <span
                className="shrink-0 rounded px-1.5 py-px text-[11px] tnum"
                style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
                title={`${task.grade_weight}% of the final grade`}
              >
                {task.grade_weight}% of grade
              </span>
            )}
            {task.recurring_task_id != null && (
              <span
                aria-label="Repeats weekly"
                title="Repeats weekly"
                className="shrink-0 text-chalk-faint"
              >
                <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor"
                     strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6.5A5 5 0 0111.5 4.3M12 2v2.5H9.5" />
                  <path d="M12 7.5a5 5 0 01-9.5 2.2M2 12v-2.5h2.5" />
                </svg>
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <DueChip due={task.due_date} />
            <EffortBar minutes={task.estimated_duration} invested={task.time_invested} color={color} />
            <StressMeter value={task.stress_rating} />
            <span className="text-[11px] text-chalk-faint">{typeLabel(task.task_type)}</span>
          </div>

          {subtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="mt-2 flex items-center gap-1.5 text-[12px] text-chalk-faint
                         transition-colors hover:text-chalk-dim"
            >
              <span
                className="inline-block transition-transform"
                style={{ transform: open ? 'rotate(90deg)' : undefined }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 2.5L8 6l-3.5 3.5" />
                </svg>
              </span>
              {remaining === 0
                ? `All ${subtasks.length} steps finished`
                : `${remaining} of ${subtasks.length} steps left`}
            </button>
          )}

          {open && (
            <ul className="mt-2 ml-1 space-y-1.5 border-l border-ink-700 pl-4">
              {subtasks.map((subtask) => {
                const done = subtask.status !== 'pending'
                const going = leavingSubtasks.has(`sub-${subtask.id}`)
                return (
                  <li
                    key={subtask.id}
                    className={`flex items-center gap-2.5 text-[12px] ${done || going ? 'opacity-45' : ''}`}
                  >
                    <button
                      type="button"
                      disabled={done || busy}
                      onClick={() => onCompleteSubtask(subtask.id)}
                      aria-label={`Mark ${subtask.phase || 'step'} done`}
                      className="shrink-0"
                    >
                      <Tick small done={done} color={color} />
                    </button>
                    <span className={`capitalize ${done || going ? 'line-through' : 'text-chalk-dim'}`}>
                      {subtask.phase || subtask.title}
                    </span>
                    {subtask.requires_focus && (
                      <span
                        className="size-[5px] shrink-0 rounded-full"
                        style={{ background: color }}
                        title="Needs your focus hours"
                      />
                    )}
                    <span className="text-chalk-faint tnum">
                      {hoursLabel(subtask.estimated_duration)}
                    </span>
                    <span className="ml-auto text-chalk-faint tnum">
                      {dueLabel(subtask.due_by)}
                    </span>
                    {!done && (
                      <button
                        type="button"
                        onClick={() => onSkipSubtask(subtask.id)}
                        className="text-chalk-faint opacity-0 transition-opacity
                                   group-hover:opacity-100 hover:text-chalk-dim focus-visible:opacity-100"
                      >
                        skip
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 gap-2 text-[12px] text-chalk-faint opacity-0
                        transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={onSkip} className="transition-colors hover:text-chalk-dim">
            Skip
          </button>
          <button type="button" onClick={onDelete} className="transition-colors hover:text-alarm">
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}

function Tick({ done, small, color = 'var(--color-chalk-faint)' }) {
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
function EffortBar({ minutes, invested, color }) {
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
