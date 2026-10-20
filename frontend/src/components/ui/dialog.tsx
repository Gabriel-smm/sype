import { AlertDialog as AlertDialogPrimitive, Dialog as DialogPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTitle = DialogPrimitive.Title
const DialogDescription = DialogPrimitive.Description

const overlayClass = `fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out
                      data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0`

const contentClass = `fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-xl border
   appglass border-sidebar-border bg-sidebar text-sidebar-foreground outline-none
   data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4
   data-[state=closed]:animate-out data-[state=closed]:fade-out-0
   md:inset-x-auto md:top-[14vh] md:bottom-auto md:left-1/2 md:w-[min(620px,92vw)] md:-translate-x-1/2
   md:rounded-xl`

/** A centred glass dialog on desktop that becomes a bottom sheet on phones. */
function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content className={cn(contentClass, className)} {...props}>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTitle = AlertDialogPrimitive.Title
const AlertDialogDescription = AlertDialogPrimitive.Description
const AlertDialogCancel = AlertDialogPrimitive.Cancel
const AlertDialogAction = AlertDialogPrimitive.Action

/** The same surface as `DialogContent`, as a `role="alertdialog"` that only its buttons or Esc close. */
function AlertDialogContent({ className, children, ...props }: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className={overlayClass} />
      <AlertDialogPrimitive.Content className={cn(contentClass, className)} {...props}>
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}

export {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
  Dialog, DialogContent, DialogDescription, DialogTitle,
}
