import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTitle = DialogPrimitive.Title
const DialogDescription = DialogPrimitive.Description

/** A centred glass dialog on desktop that becomes a bottom sheet on phones. */
function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out
                   data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogPrimitive.Content
        className={cn(
          `fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-white/10
           bg-neutral-950/90 shadow-2xl backdrop-blur-2xl outline-none
           data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4
           data-[state=closed]:animate-out data-[state=closed]:fade-out-0
           md:inset-x-auto md:top-[14vh] md:bottom-auto md:left-1/2 md:w-[min(620px,92vw)] md:-translate-x-1/2
           md:rounded-3xl`,
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export { Dialog, DialogContent, DialogDescription, DialogTitle }
