import { useEffect } from 'react'

import type { ToastState } from '../types/app'

/**
 * A short confirmation of what just happened, with at most one follow-up
 * action (Undo, Show me). It leaves by itself; nothing depends on reading it.
 */
export default function Toast(
  { toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void },
) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(onDismiss, toast.action ? 7000 : 4500)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[60] flex w-max max-w-[92vw] -translate-x-1/2 items-center gap-3
                 rounded-xl border border-ink-700 bg-ink-800 px-4 py-2.5 text-[13px] shadow-2xl md:bottom-6"
    >
      <span className={toast.tone === 'warn' ? 'text-lamp' : 'text-chalk'}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="font-semibold text-lamp hover:underline"
          onClick={() => { toast.action?.onClick(); onDismiss() }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={onDismiss}
              className="text-chalk-faint hover:text-chalk">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
             strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
    </div>
  )
}
