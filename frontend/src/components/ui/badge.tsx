import type { ComponentProps, CSSProperties } from 'react'

import { cn } from '@/lib/utils'

/** A small pill. Pass `tint` to colour it by task type. */
function Badge({ className, tint, style, ...props }: ComponentProps<'span'> & { tint?: string }) {
  const tinted: CSSProperties | undefined = tint
    ? {
        color: tint,
        background: `color-mix(in oklab, ${tint} 14%, transparent)`,
        borderColor: `color-mix(in oklab, ${tint} 30%, transparent)`,
      }
    : undefined
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-xs whitespace-nowrap text-muted-foreground tnum',
        className,
      )}
      style={{ ...tinted, ...style }}
      {...props}
    />
  )
}

function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-md border border-white/15 bg-white/[0.06] px-1 font-sans text-[11px] text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Badge, Kbd }
