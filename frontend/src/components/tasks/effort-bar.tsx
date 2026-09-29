import { hoursLabel } from '@/lib/time'

/** How much work this is, and how much of it is already behind you. */
export function EffortBar({ minutes, invested, color }: { minutes: number; invested: number; color: string }) {
  const progress = minutes > 0 ? Math.min(invested / minutes, 1) : 0
  // Six hours of work fills the bar; anything longer simply maxes it out.
  const weight = Math.max(Math.min(minutes / 360, 1) * 100, 8)

  return (
    <span
      className="flex items-center gap-1.5"
      title={invested > 0
        ? `${hoursLabel(minutes)} estimated, ${hoursLabel(invested)} already done`
        : `${hoursLabel(minutes)} of work`}
    >
      <span className="relative block h-1 w-10 overflow-hidden rounded-full bg-white/10">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${weight}%`, background: `color-mix(in oklab, ${color} 55%, transparent)` }}
        />
        {progress > 0 && (
          <span className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${progress * weight}%`, background: color }} />
        )}
      </span>
      <span className="text-xs text-faint tnum">{hoursLabel(minutes)}</span>
    </span>
  )
}
