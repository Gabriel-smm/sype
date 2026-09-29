import { Slider as SliderPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** A single-thumb slider. `color` tints the filled range. */
function Slider({ className, color, ...props }: ComponentProps<typeof SliderPrimitive.Root> & { color?: string }) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-6 w-full touch-none items-center select-none data-[disabled]:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-white/10">
        <SliderPrimitive.Range
          className="absolute h-full rounded-full"
          style={{ background: color ?? 'var(--primary)' }}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={props['aria-label']}
        className="block size-4 rounded-full border-2 border-white bg-black shadow transition-transform
                   hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
    </SliderPrimitive.Root>
  )
}

export { Slider }
