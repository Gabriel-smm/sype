import { useState } from 'react'

import { hoursLabel } from '../lib/time'

/**
 * Work the scheduler could not place, with the fixes a student would actually
 * reach for. Grouped by task, since a fix (a later deadline, a smaller
 * estimate) applies to the whole task rather than one of its steps.
 */
export default function FitFixes({ items, busy, onPushDeadline, onEdit, onFocusHours, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!items.length) return null

  const groups = []
  for (const item of items) {
    const group = groups.find((g) => item.task_id != null && g.taskId === item.task_id)
    if (group) group.items.push(item)
    else groups.push({ taskId: item.task_id, items: [item] })
  }

  return (
    <section className="rounded-xl border border-lamp/25 bg-lamp/[0.06]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-lamp"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
             className="transition-transform" style={{ transform: open ? 'rotate(90deg)' : undefined }}>
          <path d="M6 3l5 5-5 5" />
        </svg>
        {items.length === 1
          ? 'One piece of work did not fit in your week'
          : `${items.length} pieces of work did not fit in your week`}
      </button>

      {open && (
        <ul className="space-y-3 px-3.5 pb-3.5">
          {groups.map((group) => (
            <li key={`${group.taskId}-${group.items[0].subtask_id}`}
                className="rounded-lg bg-ink-900/70 px-3 py-2.5 text-[13px]">
              {group.items.map((item) => (
                <p key={`${item.task_id}-${item.subtask_id}`} className="text-chalk-dim">
                  <span className="text-chalk">{item.title}</span>{' '}
                  <span className="text-chalk-faint">
                    needs {hoursLabel(item.estimated_duration)} — {item.reason}
                  </span>
                </p>
              ))}
              {group.taskId != null && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" className="btn-quiet" disabled={busy}
                          onClick={() => onPushDeadline(group.taskId, 2)}>
                    Due 2 days later
                  </button>
                  <button type="button" className="btn-quiet" onClick={() => onEdit(group.taskId)}>
                    Change estimate…
                  </button>
                  <button type="button" className="btn-quiet" onClick={onFocusHours}>
                    Add focus hours
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
