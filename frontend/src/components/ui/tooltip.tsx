import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: ComponentProps<typeof TooltipPrimitive.Content>['side']
  className?: string
}

function Tooltip({ content, children, side = 'bottom', className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(
            `z-50 max-w-64 rounded-xl border border-white/10 bg-neutral-900/95 px-3 py-1.5 text-xs text-foreground
             shadow-xl backdrop-blur-xl data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0`,
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip, TooltipProvider }
