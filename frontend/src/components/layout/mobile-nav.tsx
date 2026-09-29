import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

import { NAV_ITEMS } from './nav-items'

/** Phones get the pages as a glass tab bar within thumb reach. */
export function MobileNav() {
  return (
    <nav
      aria-label="Pages"
      className="glass fixed inset-x-3 bottom-3 z-40 rounded-full bg-black/60 p-1.5 md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] transition-colors',
                isActive ? 'bg-white/10 text-foreground' : 'text-faint',
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('size-[18px]', isActive && 'text-accent-ink')} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
