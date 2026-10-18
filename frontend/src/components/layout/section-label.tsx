import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Sype's small section header: an icon and a bold label, e.g. "Quick Wins". */
export function SectionLabel({ icon: Icon, children, aside, id }: {
  icon: LucideIcon
  children: ReactNode
  aside?: ReactNode
  id?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-3.5 text-white/60" />
      <h2 id={id} className="text-xs font-semibold text-white">{children}</h2>
      {aside != null && <span className="ml-auto text-[10px] text-white/40 tnum">{aside}</span>}
    </div>
  )
}
