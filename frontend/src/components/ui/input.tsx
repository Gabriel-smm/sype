import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

// Sype's app fields: a 2px zinc outline that rings blue on focus.
const fieldClasses = `w-full min-w-0 rounded-md border-2 border-sidebar-border bg-transparent px-3 text-sm
  text-sidebar-accent-foreground transition-colors outline-none placeholder:text-sidebar-foreground/40
  focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none disabled:opacity-50 [color-scheme:dark]`

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
         bg-[position:right_0.7rem_center] bg-no-repeat pr-8 [&>option]:bg-neutral-900`,
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
      className={cn(fieldClasses, 'py-2', className)}
      {...props}
    />
  )
}

function Label({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('mb-1.5 block text-xs text-sidebar-foreground/60', className)} {...props} />
}

export { Input, Label, NativeSelect, Textarea }
