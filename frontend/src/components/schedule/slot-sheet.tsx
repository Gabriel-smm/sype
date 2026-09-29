import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { typeColor, typeLabel } from '@/lib/task-meta'
import { formatClock, hoursLabel } from '@/lib/time'
import type { ScheduleSlot } from '@/types/api'
import type { SlotAction } from '@/types/app'

interface SlotSheetProps {
  slot: ScheduleSlot | null
  onClose: () => void
  onComplete: SlotAction
  onSkip: SlotAction
  onEditTask: (taskId: number) => void
}

/** One scheduled session, and why the scheduler put it where it is. */
export function SlotSheet({ slot, onClose, onComplete, onSkip, onEditTask }: SlotSheetProps) {
  return (
    <Sheet open={Boolean(slot)} onOpenChange={(open) => !open && onClose()}>
      {slot && (
        <SheetContent title={slot.title} description={slot.parent_title ? `Part of ${slot.parent_title}` : undefined}>
          <SlotDetail slot={slot} onClose={onClose} onComplete={onComplete} onSkip={onSkip} onEditTask={onEditTask} />
        </SheetContent>
      )}
    </Sheet>
  )
}

function SlotDetail({ slot, onClose, onComplete, onSkip, onEditTask }: SlotSheetProps & { slot: ScheduleSlot }) {
  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)
  const color = typeColor(slot.task_type)
  const id = slot.subtask_id ?? slot.task_id

  const act = async (action: SlotAction) => {
    if (id == null) return
    await action(id, slot.subtask_id != null)
    onClose()
  }

  return (
    <div className="space-y-6 text-sm">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="text-foreground tnum">
          {start.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div className="text-muted-foreground tnum">
          {formatClock(start)} – {formatClock(end)}
          <span className="text-faint"> ({hoursLabel((end.getTime() - start.getTime()) / 60000)})</span>
        </div>
      </div>

      <Fact label="Kind of work"><Badge tint={color}>{typeLabel(slot.task_type)}</Badge></Fact>

      <Fact label="Due">
        <span className={slot.overdue ? 'text-destructive' : ''}>
          {new Date(slot.due_date).toLocaleString([], {
            weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
          })}
          {slot.overdue && '. Already past.'}
        </span>
      </Fact>

      <Fact label="Why it landed here">
        <span className="leading-relaxed text-muted-foreground">
          Priority <span className="text-foreground tnum">{slot.priority_score.toFixed(2)}</span>
          {slot.requires_focus
            ? '. This needs concentration, so it was kept inside your focus hours.'
            : slot.in_productive_hours
              ? '. It happens to fall in your focus hours.'
              : '. It does not need deep focus, so any free time would do.'}
        </span>
      </Fact>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-5">
        <Button onClick={() => void act(onComplete)}>Mark done</Button>
        <Button variant="secondary" onClick={() => void act(onSkip)}>Skip it</Button>
        {slot.task_id != null && (
          <Button variant="ghost" className="ml-auto"
                  onClick={() => { onEditTask(slot.task_id!); onClose() }}>
            Edit task
          </Button>
        )}
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] text-faint">{label}</div>
      <div>{children}</div>
    </div>
  )
}
