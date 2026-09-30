import { cva, type VariantProps } from 'class-variance-authority'
import { PanelLeft } from 'lucide-react'
import { Dialog as SheetPrimitive, Slot } from 'radix-ui'
import {
  useCallback, useEffect, useMemo, useState, type ComponentProps, type CSSProperties, type ReactNode,
} from 'react'

import { Tooltip } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { SidebarContext, useSidebar, type SidebarContextValue } from '@/hooks/use-sidebar'
import { cn } from '@/lib/utils'

// A lean version of shadcn's sidebar, as Sype's app uses it: floating, glass,
// collapsing to a rail of icons, and a sheet on phones.
const STORAGE_KEY = 'sidebar_state'
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '3rem'
const SHORTCUT = 'b'

function readStored(fallback: boolean) {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value == null ? fallback : value === 'true'
  } catch {
    return fallback
  }
}

function SidebarProvider({ defaultOpen = false, className, style, children }: {
  defaultOpen?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = useState(false)
  const [open, setOpenState] = useState(() => readStored(defaultOpen))

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Storage can be refused; the choice then lasts this visit.
    }
  }, [])

  const toggleSidebar = useCallback(
    () => (isMobile ? setOpenMobile((value) => !value) : setOpen(!open)),
    [isMobile, open, setOpen],
  )

  // Ctrl/Cmd+B, as in Sype.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSidebar])

  const value = useMemo<SidebarContextValue>(() => ({
    state: open ? 'expanded' : 'collapsed', open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar,
  }), [open, setOpen, isMobile, openMobile, toggleSidebar])

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        style={{
          '--sidebar-width': SIDEBAR_WIDTH,
          '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
          ...style,
        } as CSSProperties}
        className={cn('group/sidebar-wrapper flex h-dvh w-full overflow-hidden', className)}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

const panelClasses = 'appglass flex h-full w-full flex-col rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm'

function Sidebar({ className, children }: { className?: string; children: ReactNode }) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (isMobile) {
    return (
      <SheetPrimitive.Root open={openMobile} onOpenChange={setOpenMobile}>
        <SheetPrimitive.Portal>
          <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <SheetPrimitive.Content
            data-mobile="true"
            className="group fixed inset-y-0 left-0 z-50 p-2 data-[state=open]:animate-in data-[state=open]:slide-in-from-left"
            style={{ width: SIDEBAR_WIDTH_MOBILE }}
          >
            <SheetPrimitive.Title className="sr-only">Navigation</SheetPrimitive.Title>
            <SheetPrimitive.Description className="sr-only">Pages and your subjects.</SheetPrimitive.Description>
            <div className={panelClasses}>{children}</div>
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      </SheetPrimitive.Root>
    )
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === 'collapsed' ? 'icon' : ''}
      data-variant="floating"
      data-slot="sidebar"
    >
      {/* Reserves the sidebar's width in the flow. */}
      <div
        className="relative h-full bg-transparent transition-[width] duration-200 ease-linear
                   w-(--sidebar-width) group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
      />
      <div
        className={cn(
          `fixed inset-y-0 left-0 z-10 hidden h-dvh p-2 transition-[width] duration-200 ease-linear md:flex
           w-(--sidebar-width) group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]`,
          className,
        )}
      >
        <div data-sidebar="sidebar" className={panelClasses}>{children}</div>
      </div>
    </div>
  )
}

function SidebarInset({ className, ...props }: ComponentProps<'main'>) {
  return <main className={cn('relative flex min-w-0 w-full flex-1 flex-col', className)} {...props} />
}

function SidebarTrigger({ className, ...props }: ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cn('grid size-8 place-items-center rounded-md text-sidebar-foreground/80 hover:bg-white/10', className)}
      {...props}
    >
      <PanelLeft className="size-4" />
      <span className="sr-only">Toggle sidebar</span>
    </button>
  )
}

function SidebarHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-sidebar="header" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
}

function SidebarFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-sidebar="footer" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
}

function SidebarContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-sidebar="content"
      className={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden', className)}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div data-sidebar="group" className={cn('relative flex w-full min-w-0 flex-col p-2', className)} {...props} />
}

function SidebarGroupLabel({ className, asChild = false, ...props }: ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div'
  return (
    <Comp
      data-sidebar="group-label"
      className={cn(
        `flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-hidden
         ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0
         group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0`,
        className,
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-sidebar="group-content" className={cn('w-full text-sm', className)} {...props} />
}

function SidebarMenu({ className, ...props }: ComponentProps<'ul'>) {
  return <ul data-sidebar="menu" className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: ComponentProps<'li'>) {
  return <li data-sidebar="menu-item" className={cn('group/menu-item relative', className)} {...props} />
}

const sidebarMenuButtonVariants = cva(
  `peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden
   ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
   focus-visible:ring-2 active:bg-sidebar-accent disabled:pointer-events-none disabled:opacity-50
   data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground
   data-[state=open]:hover:bg-sidebar-accent group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!
   [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0`,
  {
    variants: {
      size: {
        default: 'h-8 text-sm',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: { size: 'default' },
  },
)

type MenuButtonProps = ComponentProps<'button'> & VariantProps<typeof sidebarMenuButtonVariants> & {
  asChild?: boolean
  isActive?: boolean
  /** Shown beside the icon when the sidebar is collapsed to its rail. */
  tooltip?: string
}

function SidebarMenuButton({ asChild = false, isActive = false, size, tooltip, className, ...props }: MenuButtonProps) {
  const { state, isMobile } = useSidebar()
  const Comp = asChild ? Slot.Root : 'button'
  const button = (
    <Comp
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ size }), className)}
      {...props}
    />
  )
  if (!tooltip || state !== 'collapsed' || isMobile) return button
  return <Tooltip content={tooltip} side="right">{button}</Tooltip>
}

export {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarTrigger,
}
