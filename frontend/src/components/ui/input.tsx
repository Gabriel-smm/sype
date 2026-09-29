import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

// Sype's field: frosted white, a blue edge on focus.
const fieldClasses = `w-full min-w-0 rounded-full border border-white/20 bg-white/10 px-4 text-sm text-white
  backdrop-blur-md transition-all outline-none placeholder:text-white/40
  focus-visible:border-blue-400/50 focus-visible:bg-white/15 focus-visible:outline-none
  disabled:opacity-50 [color-scheme:dark]`

function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(fieldClasses, 'h-10', className)} {...props} />
}

/** A styled native select: the platform picker is the most usable one on phones. */
function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        fieldClasses,
        `h-10 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23ffffff99' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 4.5l3 3 3-3'/%3E%3C/svg%3E")]
         bg-[position:right_0.9rem_center] bg-no-repeat pr-9 [&>option]:bg-neutral-900`,
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClasses, 'rounded-2xl py-2.5', className)}
      {...props}
    />
  )
}

function Label({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('mb-1.5 block text-[13px] text-muted-foreground', className)} {...props} />
}

export { Input, Label, NativeSelect, Textarea }
