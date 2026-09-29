import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Glass toasts, bottom centre, clear of the phone tab bar. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: 88 }}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-2xl !border !border-white/10 !bg-neutral-900/90 !text-foreground !shadow-2xl !backdrop-blur-xl',
          description: '!text-muted-foreground',
          actionButton: '!rounded-full !bg-primary !px-3 !text-primary-foreground',
          warning: '!text-type-routine',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
