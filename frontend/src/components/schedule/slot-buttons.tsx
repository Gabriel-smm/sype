import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ScheduleSlot } from '@/types/api'
import type { SlotAction } from '@/types/app'

interface SlotButtonsProps {
  slot: ScheduleSlot
  busy: boolean
  onComplete: SlotAction
  onSkip: SlotAction
  small?: boolean
}

/** Done / Skip for one scheduled session; a session is a step when it has a subtask. */
export function SlotButtons({ slot, busy, onComplete, onSkip, small = false }: SlotButtonsProps) {
  const id = slot.subtask_id ?? slot.task_id
  if (id == null) return null
  const isSubtask = slot.subtask_id != null

  return (
    <span className="flex shrink-0 gap-1.5">
      <Button size={small ? 'sm' : 'default'} variant={small ? 'secondary' : 'default'} disabled={busy}
              onClick={() => void onComplete(id, isSubtask)}>
        {!small && <Check className="size-4" />}
        Done
      </Button>
      <Button size={small ? 'sm' : 'default'} variant="ghost" disabled={busy}
              onClick={() => void onSkip(id, isSubtask)}>
        Skip
      </Button>
    </span>
  )
}
