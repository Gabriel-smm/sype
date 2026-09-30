import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

// Sype's app buttons: small rounded-md controls, the sidebar blue for the main
// action, green for "done", outlines for everything else.
const buttonVariants = cva(
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap
   transition-all duration-200 disabled:pointer-events-none disabled:opacity-45
   [&_svg]:pointer-events-none [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        default: 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90',
        success: 'bg-green-500 text-white shadow-md shadow-green-500/20 hover:bg-green-600 hover:brightness-110',
        secondary: 'border border-sidebar-border text-white/70 hover:border-white/40 hover:text-white',
        ghost: 'text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground',
        destructive: 'border border-destructive/40 text-destructive hover:bg-destructive/10',
        link: 'px-0 text-sidebar-foreground/60 underline-offset-4 hover:text-sidebar-foreground hover:underline',
      },
      size: {
        default: 'h-9 px-4 text-sm',
        sm: 'h-7 px-3 text-xs',
        lg: 'h-11 px-6 text-sm',
        icon: 'size-9',
        'icon-sm': 'size-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

function Button({ className, variant, size, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button }
