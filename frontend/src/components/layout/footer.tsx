import { NavLink } from 'react-router'

import { Logo } from './navbar'
import { NAV_ITEMS } from './nav-items'

/** Sype's footer, trimmed to what an app needs: the mark and the pages. */
export function Footer() {
  return (
    <footer className="relative mt-24">
      <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-8 px-4 py-12 md:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-white/60">Your week, planned around what matters most.</p>
        </div>
        <nav aria-label="Footer">
          <h2 className="mb-4 text-sm font-semibold">Pages</h2>
          <ul className="space-y-2">
            {NAV_ITEMS.map(({ to, label }) => (
              <li key={to}>
                <NavLink to={to} end={to === '/'} className="text-sm text-white/60 transition-colors hover:text-white">
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/5">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-white/40 md:px-6">
          Scheduling is deterministic. The same week in always gives the same plan out.
        </p>
      </div>
    </footer>
  )
}
