import { Check } from 'lucide-react'
import { Link } from 'react-router'

import { ALARM, typeColor } from '@/lib/task-meta'
import { formatClock } from '@/lib/time'
import type { ScheduleSlot } from '@/types/api'
import type { SlotAction } from '@/types/app'

interface PriorityListProps {
  slots: ScheduleSlot[]
  more: number
  now: Date
  busy: boolean
  onComplete: SlotAction
  onOpen: (slot: ScheduleSlot) => void
}

/**
 * Today's most important sessions, in rank order. The rank is real: it is the
 * scheduler's priority score, so the list reshuffles as the week moves on.
 */
export function PriorityList({ slots, more, now, busy, onComplete, onOpen }: PriorityListProps) {
  if (!slots.length) {
    return <p className="py-2 text-[13px] text-white/50">Nothing left on today’s plan.</p>
  }

  return (
    <div>
      <ol className="divide-y divide-white/[0.06]">
        {slots.map((slot, index) => (
          <PriorityRow key={slot.id} rank={index + 1} slot={slot} now={now} busy={busy}
                       onComplete={onComplete} onOpen={onOpen} />
        ))}
      </ol>
      {more > 0 && (
        <Link to="/calendar" className="mt-2 inline-block text-xs text-white/50 hover:text-white">
          {more === 1 ? '1 more session today' : `${more} more sessions today`}
        </Link>
      )}
    </div>
  )
}

function PriorityRow({ rank, slot, now, busy, onComplete, onOpen }: {
  rank: number
  slot: ScheduleSlot
  now: Date
  busy: boolean
  onComplete: SlotAction
  onOpen: (slot: ScheduleSlot) => void
}) {
  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)
  const running = start <= now && now < end
  const past = end <= now
  const elapsed = running ? (now.getTime() - start.getTime()) / (end.getTime() - start.getTime()) : 0
  const id = slot.subtask_id ?? slot.task_id

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-3 shrink-0 text-right text-[13px] text-white/35 tnum">{rank}</span>
      <span aria-hidden="true" className="h-8 w-0.5 shrink-0 rounded-full"
            style={{ background: slot.overdue ? ALARM : typeColor(slot.task_type) }} />
      <button type="button" onClick={() => onOpen(slot)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] text-white">{slot.title}</span>
        <span className="flex items-center gap-2 text-xs text-white/50 tnum">
          {formatClock(start)} – {formatClock(end)}
          {running && <span className="text-blue-400">now</span>}
          {past && <span>missed?</span>}
        </span>
        {running && (
          <span className="mt-1.5 block h-0.5 w-full max-w-48 overflow-hidden rounded-full bg-white/10"
                role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.round(elapsed * 100)}>
            <span className="block h-full bg-blue-400" style={{ width: `${elapsed * 100}%` }} />
          </span>
        )}
      </button>
      {id != null && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onComplete(id, slot.subtask_id != null)}
          aria-label={`Mark ${slot.title} done`}
          title="Mark done"
          className="grid size-7 shrink-0 place-items-center rounded-full border border-white/20 text-transparent
                     transition-colors hover:border-white/60 hover:text-white disabled:opacity-40"
        >
          <Check className="size-3.5" strokeWidth={3} />
        </button>
      )}
    </li>
  )
}
