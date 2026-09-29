import { Menu, MessageCircle, Plus, X } from 'lucide-react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useState } from 'react'
import { NavLink } from 'react-router'

import { Kbd } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { NAV_ITEMS } from './nav-items'

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <NavLink to="/" onClick={onClick} className="relative z-50 rounded-full text-2xl font-bold tracking-tighter">
      Sype<span className="text-blue-400">.</span>
    </NavLink>
  )
}

interface NavbarProps {
  pendingCount: number
  onAdd: () => void
  onChat: () => void
}

/**
 * Sype's floating glass pill, carrying the app's pages. It slides in on load
 * and tightens once the page scrolls; phones get Sype's full-screen menu.
 */
export function Navbar({ pendingCount, onAdd, onChat }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (latest) => setScrolled(latest > 50))

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('fixed inset-x-0 top-0 z-50 px-4 transition-all duration-300 md:px-6', scrolled ? 'py-4' : 'py-6')}
    >
      <nav aria-label="Main" className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full bg-black/40 py-3 pr-3 pl-6">
        <Logo onClick={() => setMenuOpen(false)} />

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => cn(
                  'relative flex items-center gap-1.5 py-1 text-sm font-medium transition-colors',
                  isActive ? 'text-white' : 'text-white/70 hover:text-white',
                )}
              >
                {({ isActive }) => (
                  <>
                    {label}
                    {to === '/tasks' && pendingCount > 0 && <span className="text-xs text-white/40 tnum">{pendingCount}</span>}
                    {isActive && (
                      <motion.span layoutId="nav-active" className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-blue-400" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Tooltip content="Chat about your week">
            <Button variant="ghost" size="icon-sm" onClick={onChat} aria-label="Open chat">
              <MessageCircle className="size-[18px]" />
            </Button>
          </Tooltip>
          <Button variant="inverse" onClick={onAdd} aria-keyshortcuts="n" className="max-md:hidden">
            Add task
            <Kbd className="border-black/15 bg-black/5 text-black/50">N</Kbd>
          </Button>
          <Button variant="default" size="icon-sm" onClick={onAdd} aria-label="Add a task" className="md:hidden">
            <Plus className="size-4" />
          </Button>
          <button
            type="button"
            className="relative z-50 grid size-9 place-items-center text-white md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="fixed inset-0 -z-10 flex items-center justify-center bg-black/60 md:hidden"
          >
            <ul className="flex flex-col items-center gap-8">
              {NAV_ITEMS.map(({ to, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) => cn('text-3xl font-light transition-colors hover:text-blue-400',
                      isActive ? 'text-blue-400' : 'text-white')}
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
              <li>
                <Button variant="inverse" size="lg" className="mt-4"
                        onClick={() => { setMenuOpen(false); onAdd() }}>
                  Add task
                </Button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
