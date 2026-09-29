import { ALARM, LAMP, dueLabel, urgency } from '../lib/taskMeta'

/**
 * A deadline, shown as a chip that fills up as the date approaches. The fill is
 * the information: a glance across the list tells you what is closing in,
 * without reading a single date.
 */
export default function DueChip({ due, now }: { due: string; now?: Date }) {
  const heat = urgency(due, now)
  const overdue = new Date(due) < (now ?? new Date())
  const color = overdue ? ALARM : LAMP

  return (
    <span
      className="relative inline-flex items-center overflow-hidden rounded-full border px-2 py-0.5
                 text-[11px] whitespace-nowrap tnum"
      style={{
        borderColor: `color-mix(in srgb, ${color} ${25 + heat * 55}%, transparent)`,
        color: heat > 0.35 || overdue ? color : 'var(--color-chalk-dim)',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0"
        style={{
          width: `${Math.round(heat * 100)}%`,
          background: `color-mix(in srgb, ${color} ${overdue ? 22 : 14}%, transparent)`,
        }}
      />
      <span className="relative">{dueLabel(due, now)}</span>
    </span>
  )
}
