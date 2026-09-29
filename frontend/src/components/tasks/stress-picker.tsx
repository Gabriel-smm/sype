import type { Ref } from 'react'

import { STRESS_WORDS } from '@/lib/task-meta'
import { cn } from '@/lib/utils'

interface StressPickerProps {
  value: number
  onChange: (value: number) => void
  firstRef?: Ref<HTMLButtonElement>
  className?: string
}

/** "How much is this weighing on you?" as five dots that fill in red. */
export function StressPicker({ value, onChange, firstRef, className }: StressPickerProps) {
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-[13px] text-muted-foreground">
        How much is this weighing on you?{' '}
        <span className="text-foreground">{STRESS_WORDS[value - 1]}</span>
      </legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            ref={level === 1 ? firstRef : undefined}
            type="button"
            aria-label={STRESS_WORDS[level - 1]}
            aria-pressed={value === level}
            onClick={() => onChange(level)}
            className={cn('size-7 rounded-full border transition-colors',
              level > value && 'border-white/15 hover:border-white/30')}
            style={level <= value ? {
              borderColor: 'var(--destructive)',
              background: `color-mix(in oklab, var(--destructive) ${10 + level * 8}%, transparent)`,
            } : undefined}
          />
        ))}
      </div>
    </fieldset>
  )
}
