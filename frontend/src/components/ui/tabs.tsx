import { Tabs as TabsPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex items-center gap-1 border-b border-sidebar-border', className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        `-mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm text-sidebar-foreground/60
         outline-hidden select-none hover:text-white disabled:pointer-events-none disabled:opacity-50
         data-[state=active]:border-primary data-[state=active]:text-white`,
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('outline-hidden', className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
