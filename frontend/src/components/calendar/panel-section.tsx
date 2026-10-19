import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** A collapsible side panel group ("My calendars", "Categories"), open by default. */
export function PanelSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  const id = useId()
  return (
    <section className="px-3">
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 min-w-0 flex-1 items-center justify-between rounded-md pl-2 pr-1 text-sm font-medium hover:bg-white/10"
        >
          {title}
          <ChevronDown aria-hidden className={cn('size-4 text-faint transition-transform', !open && '-rotate-90')} />
        </button>
        {action}
      </div>
      <div id={id} hidden={!open} className="pt-0.5">{children}</div>
    </section>
  )
}
