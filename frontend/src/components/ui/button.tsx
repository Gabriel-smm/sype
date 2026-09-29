import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

// Sype's pills: blue that glows and grows on hover, white for the nav's call to
// action, glass or plain text for everything else.
const buttonVariants = cva(
  `inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap
   transition-all duration-200
   disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        default:
          'bg-blue-500 font-semibold text-white shadow-[0_0_40px_-10px_rgba(59,130,246,0.4)] hover:scale-105 hover:bg-blue-600',
        inverse: 'bg-white font-semibold text-black hover:bg-white/90',
        secondary: 'border border-white/10 bg-white/[0.06] text-foreground hover:border-white/20 hover:bg-white/10',
        ghost: 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground',
        destructive: 'border border-destructive/40 text-destructive hover:bg-destructive/10',
        link: 'rounded-md px-0 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
      },
      size: {
        default: 'h-10 px-5 text-sm',
        sm: 'h-8 px-3.5 text-[13px]',
        lg: 'h-14 px-8 text-lg',
        icon: 'size-10',
        'icon-sm': 'size-8',
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
