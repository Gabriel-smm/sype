import { Avatar as AvatarPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Avatar({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Root>) {
  return <AvatarPrimitive.Root className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-lg', className)} {...props} />
}

function AvatarFallback({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn('flex size-full items-center justify-center rounded-lg bg-white/5 text-xs font-medium', className)}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback }
