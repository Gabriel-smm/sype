import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { useState } from 'react'

import { SlotSheet } from '@/components/schedule/slot-sheet'
import { WeekGrid } from '@/components/schedule/week-grid'
import { FitFixes } from '@/components/tasks/fit-fixes'
import { Card } from '@/components/ui/card'
import { Tooltip } from '@/components/ui/tooltip'
import { weekStartOf } from '@/lib/time'
import type { Schedule, ScheduleSlot, Settings } from '@/types/api'
import type { Fixes, SlotAction } from '@/types/app'

interface CalendarPageProps {
  schedule: Schedule
  settings: Settings
  busy: boolean
  onRegenerate: () => void
  onMoveSlot: (slot: ScheduleSlot, start: Date, end: Date) => void
  onComplete: SlotAction
  onSkip: SlotAction
  onOpenTask: (taskId: number) => void
  fixes: Fixes
}

/** Sype's weekly calendar card: month title, week arrows, Today, and the grid. */
export function CalendarPage({
  schedule, settings, busy, onRegenerate, onMoveSlot, onComplete, onSkip, onOpenTask, fixes,
}: CalendarPageProps) {
  const [date, setDate] = useState(() => new Date())
  const [selected, setSelected] = useState<ScheduleSlot | null>(null)

  const shiftWeek = (weeks: number) => {
    const next = new Date(date)
    next.setDate(next.getDate() + weeks * 7)
    setDate(next)
  }
  const month = weekStartOf(date).toLocaleDateString([], { month: 'long', year: 'numeric' })
  const navButton = 'rounded-lg p-1 transition-colors duration-200 hover:bg-white/10'

  return (
    <Card className="h-full min-h-0 w-full overflow-hidden pb-0">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 px-4">
        <h2 className="text-sm font-semibold text-sidebar-foreground">{month}</h2>
        <div className="flex items-center gap-3">
          <Legend />
          <Tooltip content="Rebuild the week. This also undoes sessions you dragged.">
            <button type="button" onClick={onRegenerate} disabled={busy} aria-label="Rebuild schedule"
                    className={`${navButton} disabled:opacity-40`}>
              <RotateCw className={`size-4 text-sidebar-foreground ${busy ? 'animate-spin' : ''}`} />
            </button>
          </Tooltip>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week" className={navButton}>
              <ChevronLeft className="size-4 text-sidebar-foreground" />
            </button>
            <button
              type="button"
              onClick={() => setDate(new Date())}
              className="rounded-lg bg-sidebar-primary px-4 py-1 text-xs font-medium text-sidebar-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Today
            </button>
            <button type="button" onClick={() => shiftWeek(1)} aria-label="Next week" className={navButton}>
              <ChevronRight className="size-4 text-sidebar-foreground" />
            </button>
          </div>
        </div>
      </div>

      {schedule.unschedulable.length > 0 && (
        <div className="-mt-3 flex-shrink-0 px-4">
          <FitFixes items={schedule.unschedulable} busy={busy} {...fixes} />
        </div>
      )}

      <div className="relative -mt-2 flex min-h-0 flex-1 flex-col">
        <WeekGrid
          slots={schedule.slots}
          fixedBlocks={settings.fixed_blocks}
          productiveHours={settings.productive_hours}
          date={date}
          selectedId={selected?.id}
          onSelectSlot={setSelected}
          onMoveSlot={onMoveSlot}
        />
      </div>

      <SlotSheet slot={selected} onClose={() => setSelected(null)} onComplete={onComplete}
                 onSkip={onSkip} onEditTask={onOpenTask} />
    </Card>
  )
}

function Legend() {
  return (
    <ul className="hidden items-center gap-3 text-[11px] text-sidebar-foreground/50 xl:flex">
      <li className="flex items-center gap-1.5"><span className="block size-2.5 rounded-sm bg-blue-500/25" />Focus hours</li>
      <li className="flex items-center gap-1.5"><span className="hatched block size-2.5 rounded-sm border border-white/15" />Busy</li>
      <li className="flex items-center gap-1.5"><span className="block h-2.5 w-1 rounded-sm bg-red-500" />Now</li>
    </ul>
  )
}
