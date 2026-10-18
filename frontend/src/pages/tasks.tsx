import { Check, CheckSquare, ChevronDown, Plus, Repeat, Sparkles, Wrench, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { SectionLabel } from '@/components/layout/section-label'
import { SubjectPill } from '@/components/tasks/subject-pill'
import { Kbd } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { dueLabel, typeLabel } from '@/lib/task-meta'
import { hoursLabel } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { Schedule, Task } from '@/types/api'
import type { Actions } from '@/types/app'

// Work with this little left to do is a quick win; the rest is maintenance.
const QUICK_WIN_MINUTES = 60
const FOCUS_TYPES = new Set(['essay_project', 'exam_study'])

const remaining = (task: Task) => Math.max(task.estimated_duration - task.time_invested, 0)
const byDue = (a: Task, b: Task) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()

/** The scheduler's own ranking: a task's highest priority across its sessions and unplaced steps. */
function priorities(schedule: Schedule): Map<number, number> {
  const scores = new Map<number, number>()
  for (const item of [...schedule.slots, ...schedule.unschedulable]) {
    if (item.task_id == null) continue
    scores.set(item.task_id, Math.max(scores.get(item.task_id) ?? 0, item.priority_score))
  }
  return scores
}

interface TasksPageProps {
  tasks: Task[]
  schedule: Schedule
  busy: boolean
  actions: Actions
  onOpenTask: (taskId: number) => void
  onCapture: () => void
}

/** Sype's triage: one high hurdle, the maintenance work, and the quick wins. */
export function TasksPage({ tasks, schedule, busy, actions, onOpenTask, onCapture }: TasksPageProps) {
  const [params] = useSearchParams()
  const type = params.get('type')
  const [showDone, setShowDone] = useState(false)
  const [ticked, setTicked] = useState(() => new Set<number>())

  const scores = priorities(schedule)
  const inScope = (task: Task) => !type || task.task_type === type
  const pending = tasks.filter((task) => task.status === 'pending' && inScope(task))
  const finished = tasks.filter((task) => task.status !== 'pending' && inScope(task))

  const ranked = [...pending].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || byDue(a, b))
  const hurdle = ranked[0] ?? null
  const others = ranked.slice(1)
  const maintenance = others.filter((task) => remaining(task) > QUICK_WIN_MINUTES).sort(byDue)
  const quickWins = others.filter((task) => remaining(task) <= QUICK_WIN_MINUTES).sort(byDue)

  // Let the tick land before the row leaves.
  async function tick(id: number) {
    setTicked((current) => new Set(current).add(id))
    try {
      await actions.completeTask(id)
    } finally {
      setTicked((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <Card className="h-full min-h-0 w-full pb-0">
      <CardHeader
        title="Tasks"
        description={type ? `${typeLabel(type)}, ${pending.length} to do` : 'Manage your assignments'}
        actions={
          <>
            {type && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/tasks"><X className="size-3.5" />All subjects</Link>
              </Button>
            )}
            <Button size="sm" onClick={onCapture}><Plus className="size-3.5" />New task</Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {!hurdle && (
          type ? (
            <p className="py-10 text-center text-sm text-white/50">Nothing to do in {typeLabel(type)} right now.</p>
          ) : (
            <button type="button" onClick={onCapture}
                    className="w-full rounded-lg border-2 border-dashed border-sidebar-border px-6 py-10 text-center text-sm
                               text-white/60 transition-colors hover:border-white/30 hover:bg-white/5">
              Nothing on the list. Add a task, or press <Kbd>N</Kbd> anywhere, and the week builds around it.
            </button>
          )
        )}

        {hurdle && <HighHurdle task={hurdle} busy={busy} actions={actions} onOpen={() => onOpenTask(hurdle.id)} />}

        {maintenance.length > 0 && (
          <section className="space-y-1.5">
            <SectionLabel icon={Wrench} aside={maintenance.length}>Maintenance &amp; Upkeep</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {maintenance.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTask(task.id)}
                  className="rounded-md border border-sidebar-border bg-sidebar/60 p-3 text-left transition-colors duration-200
                             hover:border-white/20 hover:bg-white/10"
                >
                  <span className="flex items-center justify-between gap-2">
                    <SubjectPill taskType={task.task_type} />
                    {task.recurring_task_id != null && <Repeat aria-label="Repeats weekly" className="size-3 text-white/40" />}
                  </span>
                  <span className="mt-1.5 mb-1 block truncate text-[11px] font-medium text-white">{task.title}</span>
                  <span className="block text-[9px] text-white/50">
                    {dueLabel(task.due_date)}, {hoursLabel(remaining(task))} left
                    {task.grade_weight > 0 ? `, ${task.grade_weight}% of grade` : ''}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {quickWins.length > 0 && (
          <section className="space-y-1.5">
            <SectionLabel icon={CheckSquare} aside={quickWins.length}>Quick Wins</SectionLabel>
            <ul className="flex flex-col gap-1">
              {quickWins.map((task) => {
                const done = ticked.has(task.id)
                return (
                  <li key={task.id}
                      className={cn(`flex h-12 items-center gap-3 rounded-md border border-sidebar-border bg-sidebar/40 px-3
                                     transition-colors duration-200 hover:border-white/20 hover:bg-white/10`, done && 'opacity-50')}>
                    <button
                      type="button"
                      onClick={() => void tick(task.id)}
                      disabled={busy || done}
                      aria-label={`Mark ${task.title} done`}
                      className={cn('flex size-3.5 shrink-0 items-center justify-center rounded border-2 transition-all duration-200',
                        done ? 'border-green-500 bg-green-500' : 'border-white/30 hover:border-white/50')}
                    >
                      {done && <Check className="size-2.5 text-white" strokeWidth={3} />}
                    </button>
                    <button type="button" onClick={() => onOpenTask(task.id)}
                            className={cn('min-w-0 flex-1 truncate text-left text-[11px] text-white', done && 'line-through')}>
                      {task.title}
                      <span className="text-white/40">, {dueLabel(task.due_date)}</span>
                    </button>
                    <SubjectPill taskType={task.task_type} />
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {finished.length > 0 && (
          <section className="border-t border-sidebar-border pt-3">
            <button type="button" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white">
              <ChevronDown className={cn('size-3.5 transition-transform', !showDone && '-rotate-90')} />
              {finished.length} finished
            </button>
            {showDone && (
              <ul className="mt-2 flex flex-col gap-1">
                {finished.map((task) => (
                  <li key={task.id}>
                    <button type="button" onClick={() => onOpenTask(task.id)}
                            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[11px] text-white/40 hover:bg-white/5">
                      <span className="flex size-3.5 items-center justify-center rounded border-2 border-green-500/60 bg-green-500/30">
                        <Check className="size-2.5 text-white" strokeWidth={3} />
                      </span>
                      <span className="flex-1 truncate line-through">{task.title}</span>
                      {task.status === 'skipped' ? 'skipped' : 'done'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Card>
  )
}

function HighHurdle({ task, busy, actions, onOpen }: { task: Task; busy: boolean; actions: Actions; onOpen: () => void }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const steps = task.subtasks ?? []
  const insight = `~${hoursLabel(remaining(task))} • ${FOCUS_TYPES.has(task.task_type) ? 'Heavy Focus' : 'Light Focus'}`
  const meta = [
    task.grade_weight > 0 ? `Impact: ${task.grade_weight}% of Grade` : null,
    `Due ${dueLabel(task.due_date)}`,
  ].filter(Boolean).join(' • ')

  return (
    <section
      className="relative rounded-lg border border-orange-500/30 bg-sidebar/60 p-4 transition-all duration-300
                 hover:border-orange-500/50 hover:bg-sidebar/80"
      style={{ backgroundImage: 'radial-gradient(ellipse at center, transparent, rgba(249, 100, 68, 0.05), rgba(249, 115, 22, 0.05))' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <SubjectPill taskType={task.task_type} />
        <span className="flex items-center gap-1 rounded-full bg-sidebar-accent px-2 py-1 text-[10px] text-white/70">
          <Sparkles className="size-3 text-purple-400" />{insight}
        </span>
      </div>
      <button type="button" onClick={onOpen} className="block text-left">
        <h3 className="mb-1 text-base font-semibold text-white">{task.title}</h3>
        <p className="mb-3 text-xs text-white/60">{meta}</p>
      </button>
      <div className="flex gap-2">
        <Button variant="success" size="sm" disabled={busy} onClick={() => void actions.completeTask(task.id)}>Mark done</Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/calendar')}>Schedule</Button>
      </div>

      {open && steps.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-sidebar-border pt-3">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2 text-[11px]">
              <span className={cn('capitalize', step.status !== 'pending' ? 'text-white/40 line-through' : 'text-white/80')}>
                {step.phase || step.title}
              </span>
              <span className="ml-auto text-white/40 tnum">{step.status === 'pending' ? dueLabel(step.due_by) : step.status}</span>
            </li>
          ))}
        </ul>
      )}
      {steps.length > 0 && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Hide steps' : 'Show steps'}
                className="group absolute right-3 bottom-3 rounded-full p-1 hover:bg-white/10">
          <ChevronDown className={cn('size-4 text-white/50 transition-transform group-hover:text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]',
            open && 'rotate-180')} />
        </button>
      )}
    </section>
  )
}
