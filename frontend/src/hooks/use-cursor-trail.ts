import { useEffect, useState } from 'react'

const KEY = 'sype.cursor'
const REDUCED = '(prefers-reduced-motion: reduce)'
// A trail only means something under a mouse or trackpad; on touch screens it
// would just spend battery.
const FINE_POINTER = '(pointer: fine)'

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/**
 * Whether Sype's fluid cursor trail should run: on by default for mouse users,
 * off when the student turns it off in Setup or the system asks for reduced
 * motion.
 */
export function useCursorTrail() {
  const [enabled, setEnabled] = useState(readStored)
  const reduced = useMedia(REDUCED)
  const finePointer = useMedia(FINE_POINTER)

  const set = (next: boolean) => {
    setEnabled(next)
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off')
    } catch {
      // Private windows can refuse storage; the choice then lasts this visit.
    }
  }

  return { enabled, active: enabled && !reduced && finePointer, reduced, setEnabled: set }
}

export type CursorTrail = ReturnType<typeof useCursorTrail>
