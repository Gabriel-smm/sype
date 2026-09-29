import { Tabs as TabsPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1', className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        `rounded-full px-4 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground
         data-[state=active]:bg-white/10 data-[state=active]:text-foreground`,
        className,
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger }
