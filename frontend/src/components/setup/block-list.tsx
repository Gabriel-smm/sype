import { X } from 'lucide-react'

import { BLOCK_KIND_LABELS } from '@/lib/task-meta'
import { DAY_NAMES } from '@/lib/time'
import type { Block, FixedBlock } from '@/types/api'

interface BlockListProps {
  blocks: (Block & Partial<Pick<FixedBlock, 'kind'>>)[]
  onDelete: (id: number) => void
  withKind?: boolean
}

/** The exact times behind a week strip, and the keyboard path for removing them. */
export function BlockList({ blocks, onDelete, withKind = false }: BlockListProps) {
  if (!blocks.length) {
    return <p className="mt-4 text-sm text-faint">Nothing set yet.</p>
  }

  return (
    <ul className="mt-4 divide-y divide-white/[0.06] text-sm">
      {blocks.map((block) => (
        <li key={block.id} className="flex items-center gap-3 py-2.5">
          <span className="w-28 shrink-0 truncate">
            {block.label || (withKind ? BLOCK_KIND_LABELS[block.kind ?? 'other'] : 'Focus time')}
          </span>
          <span className="w-20 shrink-0 text-muted-foreground">
            {block.day_of_week === null ? 'Every day' : DAY_NAMES[block.day_of_week]}
          </span>
          <span className="text-muted-foreground tnum">{block.start_time}–{block.end_time}</span>
          {block.end_time <= block.start_time && <span className="text-xs text-faint">overnight</span>}
          <button
            type="button"
            onClick={() => onDelete(block.id)}
            aria-label={`Remove ${block.label || 'block'}`}
            className="ml-auto grid size-7 place-items-center rounded-full text-faint transition-colors
                       hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}
