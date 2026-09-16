const WORDS = ['calm', 'easy', 'fine', 'tense', 'dreading it']

/** Self-reported stress, 1 to 5, as segments rather than a number out of five. */
export default function StressMeter({ value }) {
  const level = Math.min(Math.max(Number(value) || 1, 1), 5)

  return (
    <span className="inline-flex items-center gap-1.5" title={`Stress: ${WORDS[level - 1]}`}>
      <span className="flex gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className="h-[9px] w-[3px] rounded-full"
            style={{
              background:
                step <= level
                  ? `color-mix(in srgb, var(--color-alarm) ${30 + level * 14}%, var(--color-chalk-faint))`
                  : 'var(--color-ink-700)',
            }}
          />
        ))}
      </span>
      <span className="text-[11px] text-chalk-faint">{WORDS[level - 1]}</span>
    </span>
  )
}
