import { ACCENT, ALARM, dueLabel, urgency } from '@/lib/task-meta'

/**
 * A deadline as a pill that fills as the date approaches. The fill is the
 * information: a glance down the list shows what is closing in.
 */
export function DueChip({ due, now }: { due: string; now?: Date }) {
  const heat = urgency(due, now)
  const overdue = new Date(due) < (now ?? new Date())
  const color = overdue ? ALARM : ACCENT

  return (
    <span
      className="relative inline-flex items-center overflow-hidden rounded-full border px-2.5 py-0.5
                 text-xs whitespace-nowrap tnum"
      style={{
        borderColor: `color-mix(in oklab, ${color} ${20 + heat * 50}%, transparent)`,
        color: heat > 0.35 || overdue ? color : 'var(--muted-foreground)',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0"
        style={{
          width: `${Math.round(heat * 100)}%`,
          background: `color-mix(in oklab, ${color} ${overdue ? 22 : 14}%, transparent)`,
        }}
      />
      <span className="relative">{dueLabel(due, now)}</span>
    </span>
  )
}
