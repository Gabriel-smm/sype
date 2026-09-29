import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { useState } from 'react'

import { SlotSheet } from '@/components/schedule/slot-sheet'
import { WeekGrid } from '@/components/schedule/week-grid'
import { FitFixes } from '@/components/tasks/fit-fixes'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { formatWeekRange, weekStartOf } from '@/lib/time'
import type { Schedule, ScheduleSlot, Settings } from '@/types/api'
import type { Fixes, SlotAction } from '@/types/app'

interface WeekPageProps {
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

export function WeekPage({
  schedule, settings, busy, onRegenerate, onMoveSlot, onComplete, onSkip, onOpenTask, fixes,
}: WeekPageProps) {
  const [date, setDate] = useState(() => new Date())
  const [selected, setSelected] = useState<ScheduleSlot | null>(null)

  const shiftWeek = (weeks: number) => {
    const next = new Date(date)
    next.setDate(next.getDate() + weeks * 7)
    setDate(next)
  }
  const thisWeek = weekStartOf(date).getTime() === weekStartOf(new Date()).getTime()

  return (
    // The grid scrolls inside itself, so the page fills the viewport below the nav.
    <div className="flex h-[calc(100dvh-9.5rem)] flex-col gap-4 md:h-[calc(100dvh-11.5rem)]">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{formatWeekRange(date)}</h1>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => shiftWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => shiftWeek(1)} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
          {!thisWeek && (
            <Button variant="secondary" size="sm" className="ml-1" onClick={() => setDate(new Date())}>This week</Button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <Legend />
          <Tooltip content="The week rebuilds itself after every change. This also undoes any sessions you dragged.">
            <Button variant="secondary" size="sm" onClick={onRegenerate} disabled={busy}>
              <RotateCw className="size-3.5" />
              {busy ? 'Rebuilding…' : 'Rebuild'}
            </Button>
          </Tooltip>
        </div>
      </header>

      <FitFixes items={schedule.unschedulable} busy={busy} {...fixes} />

      <WeekGrid
        slots={schedule.slots}
        fixedBlocks={settings.fixed_blocks}
        productiveHours={settings.productive_hours}
        date={date}
        selectedId={selected?.id}
        onSelectSlot={setSelected}
        onMoveSlot={onMoveSlot}
      />

      <SlotSheet slot={selected} onClose={() => setSelected(null)} onComplete={onComplete}
                 onSkip={onSkip} onEditTask={onOpenTask} />
    </div>
  )
}

function Legend() {
  return (
    <ul className="hidden items-center gap-4 text-xs text-faint lg:flex">
      <li className="flex items-center gap-1.5">
        <span className="block size-3 rounded-sm bg-blue-500/25" />Your focus hours
      </li>
      <li className="flex items-center gap-1.5">
        <span className="hatched block size-3 rounded-sm border border-white/15" />Busy
      </li>
      <li className="flex items-center gap-1.5">
        <span className="block size-1.5 rounded-full bg-type-essay" />Needs focus
      </li>
    </ul>
  )
}
