import { Link } from 'react-router'

import type { Assignment } from '@/lib/agenda'
import { ALARM, typeColor } from '@/lib/task-meta'

/** The heaviest work due in the next two weeks: weight, deadline and how far along it is. */
export function AssignmentList({ items, now, onOpen }: {
  items: Assignment[]
  now: Date
  onOpen: (taskId: number) => void
}) {
  if (!items.length) {
    return (
      <p className="py-2 text-[13px] text-white/50">
        Nothing big due in the next two weeks. <Link to="/tasks" className="underline-offset-4 hover:text-white hover:underline">See all tasks</Link>
      </p>
    )
  }

  return (
    <ul className="divide-y divide-white/[0.06]">
      {items.map(({ task, steps, stepsDone }) => {
        const due = new Date(task.due_date)
        const late = due < now
        const progress = steps ? stepsDone / steps : 0
        return (
          <li key={task.id}>
            <button type="button" onClick={() => onOpen(task.id)}
                    className="grid w-full grid-cols-[2px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 text-left
                               sm:grid-cols-[2px_minmax(0,1fr)_5.5rem_3rem_8rem]">
              <span aria-hidden="true" className="h-8 rounded-full max-sm:row-span-2" style={{ background: typeColor(task.task_type) }} />
              <span className="truncate text-[15px] text-white">{task.title}</span>
              <span className={late ? 'text-xs text-right' : 'text-xs text-right text-white/60 tnum'}
                    style={late ? { color: ALARM } : undefined}>
                {late ? 'past due' : due.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
              </span>
              <span className="text-right text-xs text-white/60 tnum max-sm:col-start-3 max-sm:row-start-2">
                {task.grade_weight > 0 ? `${task.grade_weight}%` : ''}
              </span>
              <span className="flex items-center gap-2 max-sm:col-start-2 max-sm:row-start-2">
                {steps > 0 ? (
                  <>
                    <span className="block h-1 w-14 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-white/70" style={{ width: `${progress * 100}%` }} />
                    </span>
                    <span className="text-xs text-white/45 tnum">{stepsDone}/{steps}</span>
                  </>
                ) : <span className="text-xs text-white/35">one block</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
