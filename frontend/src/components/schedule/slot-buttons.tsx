import { Button } from '@/components/ui/button'
import type { ScheduleSlot } from '@/types/api'
import type { SlotAction } from '@/types/app'

interface SlotButtonsProps {
  slot: ScheduleSlot
  busy: boolean
  onComplete: SlotAction
  onSkip: SlotAction
}

/** Done / Skip for one scheduled session; a session is a step when it has a subtask. */
export function SlotButtons({ slot, busy, onComplete, onSkip }: SlotButtonsProps) {
  const id = slot.subtask_id ?? slot.task_id
  if (id == null) return null
  const isSubtask = slot.subtask_id != null

  return (
    <span className="flex shrink-0 gap-2">
      <Button variant="success" size="sm" disabled={busy} onClick={() => void onComplete(id, isSubtask)}>Done</Button>
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => void onSkip(id, isSubtask)}>Skip</Button>
    </span>
  )
}
