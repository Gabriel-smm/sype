import { ChevronDown, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { hoursLabel } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { UnschedulableItem } from '@/types/api'
import type { Fixes } from '@/types/app'

interface FitFixesProps extends Fixes {
  items: UnschedulableItem[]
  busy: boolean
  defaultOpen?: boolean
}

/**
 * Work the scheduler could not place, with the fixes a student would actually
 * reach for, in Sype's orange "hurdle" treatment. Grouped by task, since a fix
 * (a later deadline, a smaller estimate) applies to the whole task.
 */
export function FitFixes({ items, busy, onPushDeadline, onEdit, onFocusHours, defaultOpen = false }: FitFixesProps) {
  const [open, setOpen] = useState(defaultOpen)
  if (!items.length) return null

  const groups: { taskId: number | null; items: UnschedulableItem[] }[] = []
  for (const item of items) {
    const group = groups.find((g) => item.task_id != null && g.taskId === item.task_id)
    if (group) group.items.push(item)
    else groups.push({ taskId: item.task_id, items: [item] })
  }

  return (
    <section className="rounded-lg border border-orange-500/30 bg-sidebar/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-orange-300"
      >
        <TriangleAlert className="size-3.5 shrink-0" />
        <span className="flex-1">
          {items.length === 1 ? 'One piece of work did not fit in your week' : `${items.length} pieces of work did not fit in your week`}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-white/50 transition-transform', !open && '-rotate-90')} />
      </button>

      {open && (
        <ul className="space-y-2 px-3 pb-3">
          {groups.map((group) => (
            <li key={`${group.taskId}-${group.items[0].subtask_id}`} className="rounded-md border border-sidebar-border bg-sidebar/40 p-3">
              {group.items.map((item) => (
                <p key={`${item.task_id}-${item.subtask_id}`} className="text-[11px] text-white/60">
                  <span className="font-medium text-white">{item.title}</span> needs {hoursLabel(item.estimated_duration)}. {item.reason}
                </p>
              ))}
              {group.taskId != null && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => onPushDeadline(group.taskId!, 2)}>
                    Due 2 days later
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => onEdit(group.taskId!)}>Change estimate</Button>
                  <Button variant="secondary" size="sm" onClick={onFocusHours}>Add focus hours</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
