import { useEffect, useRef, type ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children?: ReactNode
  width?: number
  bare?: boolean
  keepMounted?: boolean
}

/**
 * A right-hand detail panel. Slides in because the motion shows where it came from.
 * `bare` hands the whole body to the child (chat manages its own scrolling).
 * `keepMounted` hides rather than unmounts when closed, so the child keeps its
 * state (a chat conversation survives closing the panel).
 */
export default function Drawer({
  open, title, onClose, children, width = 360, bare = false, keepMounted = false,
}: DrawerProps) {
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open && !keepMounted) return null

  return (
    <div hidden={!open}>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-ink-950/50"
      />
      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-label={title}
        className="fixed top-0 right-0 z-50 flex h-full max-w-[94vw] flex-col
                   border-l border-ink-700 bg-ink-900 shadow-2xl
                   motion-safe:animate-[slide-in_160ms_ease-out]"
        style={{ width }}
      >
        <style>{`@keyframes slide-in { from { transform: translateX(100%) } to { transform: none } }`}</style>
        <header className="flex items-start justify-between gap-3 border-b border-ink-800 px-5 py-4">
          <h2 className="font-display text-[17px] leading-snug">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-0.5 shrink-0 rounded p-1 text-chalk-faint transition-colors hover:text-chalk"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        {bare
          ? <div className="min-h-0 flex-1">{children}</div>
          : <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>}
      </aside>
    </div>
  )
}
