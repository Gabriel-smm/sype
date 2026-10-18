import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Glass toasts, bottom centre. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: 16 }}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-lg !border !border-sidebar-border !bg-sidebar !text-sidebar-foreground !shadow-2xl',
          description: '!text-muted-foreground',
          actionButton: '!rounded-md !bg-sidebar-primary !px-3 !text-white',
          warning: '!text-type-routine',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
