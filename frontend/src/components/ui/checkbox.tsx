import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import type { ComponentProps, CSSProperties } from 'react'

import { cn } from '@/lib/utils'

type CheckboxProps = ComponentProps<typeof CheckboxPrimitive.Root> & {
  /** CSS colour for the checked fill. */
  color?: string
}

function Checkbox({ className, color = 'var(--primary)', style, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        `peer flex size-[18px] shrink-0 items-center justify-center rounded-[3px] border border-white/40
         outline-hidden disabled:cursor-not-allowed disabled:opacity-50
         data-[state=checked]:border-[var(--checkbox-color)] data-[state=checked]:bg-[var(--checkbox-color)]`,
        className,
      )}
      style={{ '--checkbox-color': color, ...style } as CSSProperties}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-[#0a0f1a]">
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
