import { ChevronRight, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { hoursLabel } from '@/lib/time'
import type { UnschedulableItem } from '@/types/api'
import type { Fixes } from '@/types/app'

interface FitFixesProps extends Fixes {
  items: UnschedulableItem[]
  busy: boolean
  defaultOpen?: boolean
}

/**
 * Work the scheduler could not place, with the fixes a student would actually
 * reach for. Grouped by task, since a fix (a later deadline, a smaller
 * estimate) applies to the whole task rather than one of its steps.
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
    <section className="rounded-3xl border border-type-routine/25 bg-type-routine/[0.06] backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left text-sm text-type-routine"
      >
        <TriangleAlert className="size-4 shrink-0" />
        <span className="flex-1">
          {items.length === 1
            ? 'One piece of work did not fit in your week'
            : `${items.length} pieces of work did not fit in your week`}
        </span>
        <ChevronRight className="size-4 shrink-0 transition-transform" style={{ transform: open ? 'rotate(90deg)' : undefined }} />
      </button>

      {open && (
        <ul className="space-y-2 px-3 pb-3">
          {groups.map((group) => (
            <li key={`${group.taskId}-${group.items[0].subtask_id}`} className="rounded-2xl bg-black/40 px-4 py-3 text-sm">
              {group.items.map((item) => (
                <p key={`${item.task_id}-${item.subtask_id}`} className="text-muted-foreground">
                  <span className="text-foreground">{item.title}</span>{' '}
                  needs {hoursLabel(item.estimated_duration)}. {item.reason}
                </p>
              ))}
              {group.taskId != null && (
                <GroupFixes taskId={group.taskId} busy={busy} onPushDeadline={onPushDeadline}
                            onEdit={onEdit} onFocusHours={onFocusHours} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function GroupFixes({ taskId, busy, onPushDeadline, onEdit, onFocusHours }: Fixes & { taskId: number; busy: boolean }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => onPushDeadline(taskId, 2)}>
        Due 2 days later
      </Button>
      <Button variant="secondary" size="sm" onClick={() => onEdit(taskId)}>Change estimate</Button>
      <Button variant="secondary" size="sm" onClick={onFocusHours}>Add focus hours</Button>
    </div>
  )
}
