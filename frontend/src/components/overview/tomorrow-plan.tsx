import type { DayPlan } from '@/lib/agenda'
import { typeColor } from '@/lib/task-meta'
import { formatClock } from '@/lib/time'
import type { ScheduleSlot } from '@/types/api'

const SHOWN = 4

/** Tomorrow in a few lines: when work starts, what it is, and what falls due. */
export function TomorrowPlan({ plan, onOpen }: { plan: DayPlan; onOpen: (slot: ScheduleSlot) => void }) {
  if (!plan.slots.length && !plan.due.length) {
    return <p className="py-2 text-[13px] text-white/50">Nothing planned. A free day.</p>
  }
  const hidden = plan.slots.length - SHOWN

  return (
    <div className="space-y-3">
      {plan.slots.length > 0 && (
        <ul className="space-y-1.5">
          {plan.slots.slice(0, SHOWN).map((slot) => (
            <li key={slot.id}>
              <button type="button" onClick={() => onOpen(slot)}
                      className="flex w-full items-center gap-2.5 text-left text-[13px] hover:text-white">
                <span className="w-16 shrink-0 text-xs text-white/45 tnum">{formatClock(new Date(slot.start_time))}</span>
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: typeColor(slot.task_type) }} />
                <span className="truncate text-white/80">{slot.title}</span>
              </button>
            </li>
          ))}
          {hidden > 0 && <li className="pl-[4.6rem] text-xs text-white/40">and {hidden} more</li>}
        </ul>
      )}
      {plan.due.length > 0 && (
        <ul className="space-y-1 border-t border-white/[0.06] pt-2.5">
          {plan.due.map((task) => (
            <li key={task.id} className="flex items-center gap-2.5 text-[13px]">
              <span className="w-16 shrink-0 text-xs text-white/45 tnum">due {formatClock(new Date(task.due_date))}</span>
              <span aria-hidden="true" className="size-1.5 shrink-0 rotate-45 bg-white/70" />
              <span className="truncate text-white/80">{task.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
