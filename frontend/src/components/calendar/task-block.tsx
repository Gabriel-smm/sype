import { Circle } from 'lucide-react'

import { hexFor, slotColor } from '@/lib/colors'
import { ALARM } from '@/lib/task-meta'
import { formatTimeRange } from '@/lib/time'
import type { ScheduleSlot } from '@/types/api'
import { ChipFrame, ChipText, type ChipInteraction, type ChipPlacement } from './event-chip'

interface TaskBlockProps {
  slot: ScheduleSlot
  placement: ChipPlacement
  interaction: ChipInteraction
  range?: { start: Date; end: Date }
  onComplete?: () => void
}

/** An auto-scheduled work block: a dashed pastel outline, and a circle that marks it done. */
export function TaskBlock({ slot, placement, interaction, range, onComplete }: TaskBlockProps) {
  const hex = hexFor(slotColor(slot))
  const start = range?.start ?? new Date(slot.start_time)
  const end = range?.end ?? new Date(slot.end_time)

  return (
    <ChipFrame
      placement={placement}
      interaction={interaction}
      label={`${slot.title}, ${formatTimeRange(start, end)}${slot.overdue ? ', overdue' : ''}`}
      className="text-white"
      style={{
        background: `color-mix(in oklab, ${hex} 16%, var(--background))`,
        border: `1px dashed ${slot.overdue ? ALARM : hex}`,
      }}
    >
      <ChipText
        title={slot.title}
        start={start}
        end={end}
        minutes={placement.minutes}
        live={interaction.lifted}
        leading={
          <button
            type="button"
            aria-label={`Mark ${slot.title} done`}
            tabIndex={interaction.lifted ? -1 : 0}
            className="-m-0.5 shrink-0 rounded-full p-0.5 hover:bg-white/15 focus-visible:outline-offset-[-2px]"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onComplete?.()
            }}
          >
            <Circle aria-hidden className="size-3" style={{ color: hex }} />
          </button>
        }
      />
    </ChipFrame>
  )
}
