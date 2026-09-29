import { STRESS_WORDS } from '@/lib/task-meta'

/** Self-reported stress, 1 to 5, as segments rather than a number out of five. */
export function StressMeter({ value }: { value: number }) {
  const level = Math.min(Math.max(Number(value) || 1, 1), 5)

  return (
    <span className="inline-flex items-center gap-1.5" title={`Stress: ${STRESS_WORDS[level - 1]}`}>
      <span className="flex gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className="h-2.5 w-[3px] rounded-full"
            style={{
              background: step <= level
                ? `color-mix(in oklab, var(--destructive) ${30 + level * 14}%, rgb(255 255 255 / 0.4))`
                : 'rgb(255 255 255 / 0.12)',
            }}
          />
        ))}
      </span>
      <span className="text-xs text-faint">{STRESS_WORDS[level - 1]}</span>
    </span>
  )
}
