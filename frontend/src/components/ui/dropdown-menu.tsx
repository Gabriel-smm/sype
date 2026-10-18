import { DropdownMenu as MenuPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const DropdownMenu = MenuPrimitive.Root
const DropdownMenuTrigger = MenuPrimitive.Trigger

function DropdownMenuContent({ className, sideOffset = 4, ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          `z-50 min-w-56 overflow-hidden rounded-lg border border-sidebar-border bg-sidebar p-1 text-sidebar-foreground
           shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuItem({ className, ...props }: ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        `relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none
         focus:bg-sidebar-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50
         [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-foreground/60`,
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-2 py-1.5 text-sm font-normal', className)} {...props} />
}

function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-sidebar-border', className)} {...props} />
}

export {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
}
