import { X } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

const Sheet = SheetPrimitive.Root
const SheetClose = SheetPrimitive.Close

interface SheetContentProps extends Omit<ComponentProps<typeof SheetPrimitive.Content>, 'title'> {
  title: ReactNode
  description?: ReactNode
  /** `bare` hands the whole body to the child (chat manages its own scrolling). */
  bare?: boolean
  /** Keep the title for screen readers only, when the child draws its own header. */
  hideHeader?: boolean
}

/** A right-hand glass panel. Radix supplies the focus trap, Esc and scroll lock. */
function SheetContent({ className, title, description, bare = false, hideHeader = false, children, ...props }: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out
                   data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <SheetPrimitive.Content
        className={cn(
          `fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[min(94vw,440px)] flex-col
           appglass border-l border-sidebar-border bg-sidebar text-sidebar-foreground outline-none
           data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=closed]:duration-150
           data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-200`,
          className,
        )}
        {...props}
      >
        {hideHeader ? (
          <>
            <SheetPrimitive.Title className="sr-only">{title}</SheetPrimitive.Title>
            <SheetPrimitive.Description className="sr-only">{description ?? 'Details'}</SheetPrimitive.Description>
          </>
        ) : (
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <SheetPrimitive.Title className="text-base leading-snug font-semibold">
              {title}
            </SheetPrimitive.Title>
            {description ? (
              <SheetPrimitive.Description className="mt-1 text-xs text-sidebar-foreground/60">
                {description}
              </SheetPrimitive.Description>
            ) : (
              <SheetPrimitive.Description className="sr-only">Details</SheetPrimitive.Description>
            )}
          </div>
          <SheetPrimitive.Close
            aria-label="Close"
            className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground
                       transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <X className="size-4" />
          </SheetPrimitive.Close>
        </header>
        )}
        {bare
          ? <div className="min-h-0 flex-1">{children}</div>
          : <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

export { Sheet, SheetClose, SheetContent }
