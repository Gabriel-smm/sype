import { Repeat } from 'lucide-react'
import { useState } from 'react'

import { Reveal } from '@/components/effects/reveal'
import { PageHeader, SectionTitle } from '@/components/layout/page-header'
import { DueChip } from '@/components/tasks/due-chip'
import { EffortBar } from '@/components/tasks/effort-bar'
import { StressMeter } from '@/components/tasks/stress-meter'
import { Tick } from '@/components/tasks/tick'
import { Badge, Kbd } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BUCKET_HEADINGS, dueBucket, typeColor, typeLabel, type DueBucket } from '@/lib/task-meta'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/api'
import type { Actions } from '@/types/app'

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

export function TasksPage({ tasks, busy, actions, onOpenTask, onCapture }: TasksPageProps) {
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

  // Let the check land before the row disappears.
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
    <div className="max-w-4xl space-y-12">
      <PageHeader
        badge={`${pending.length} pending`}
        title="Everything on"
        accent="your plate"
        description="Tap a task to change it. The week rebuilds itself around every change."
      />

      <Reveal delay={0.6}>
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList aria-label="Show">
          {FILTERS.map(([key, label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      </Reveal>

      {!pending.length && (
        filter === 'all' ? (
          <button type="button" onClick={onCapture}
                  className="w-full rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center text-[15px]
                             text-muted-foreground transition-colors hover:border-accent-ink/50">
            Nothing on the list. Add a task, or press <Kbd>N</Kbd> anywhere, and the week builds around it.
          </button>
        ) : (
          <p className="py-12 text-center text-[15px] text-faint">Nothing here right now.</p>
        )
      )}

      {grouped.map(([bucket, items], index) => (
        <Reveal key={bucket} index={index}>
        <section>
          <SectionTitle aside={items.length}>
            <span className={bucket === 'overdue' ? 'text-destructive' : undefined}>{BUCKET_HEADINGS[bucket]}</span>
          </SectionTitle>
          <ul className="glass divide-y divide-white/[0.06] overflow-hidden rounded-3xl">
            {items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                leaving={leaving.has(task.id)}
                busy={busy}
                onOpen={() => onOpenTask(task.id)}
                onComplete={() => void settle(task.id, () => actions.completeTask(task.id))}
              />
            ))}
          </ul>
        </section>
        </Reveal>
      ))}

      {finished.length > 0 && (
        <section className="border-t border-white/[0.08] pt-5">
          <Button variant="link" size="sm" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            {showDone ? 'Hide' : 'Show'} {finished.length} finished
          </Button>
          {showDone && (
            <ul className="mt-3 space-y-1">
              {finished.map((task) => (
                <li key={task.id}>
                  <button type="button" onClick={() => onOpenTask(task.id)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-faint
                                     transition-colors hover:bg-white/[0.03] hover:text-muted-foreground">
                    <Tick done size={16} />
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
    <li className={cn('flex items-start gap-4 px-6 py-5 transition-all duration-300 hover:bg-white/[0.04]', leaving && 'opacity-40')}>
      <button
        type="button"
        onClick={onComplete}
        disabled={busy}
        aria-label={`Mark ${task.title} done`}
        className="mt-0.5 shrink-0 rounded-full"
      >
        <Tick done={leaving} color={color} />
      </button>

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn('text-lg font-semibold', leaving && 'line-through')}>{task.title}</span>
          {task.grade_weight > 0 && <Badge tint={color}>{task.grade_weight}% of grade</Badge>}
          {task.recurring_task_id != null && (
            <Repeat aria-label="Repeats weekly" className="size-3.5 shrink-0 text-faint" />
          )}
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <DueChip due={task.due_date} />
          <EffortBar minutes={task.estimated_duration} invested={task.time_invested} color={color} />
          <StressMeter value={task.stress_rating} />
          <span className="text-xs text-faint">{typeLabel(task.task_type)}</span>
          {subtasks.length > 0 && (
            <span className="text-xs text-faint">
              {remaining === 0 ? 'all steps done' : `${remaining} of ${subtasks.length} steps left`}
            </span>
          )}
        </span>
      </button>
    </li>
  )
}
