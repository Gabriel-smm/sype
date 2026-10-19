// Keyboard shortcuts for the calendar page and the app's chat toggle. Pure: no DOM.
import { VIEWS, type CalendarView } from '@/lib/calendar-view'

export type CalendarShortcut =
  | { type: 'view'; view: CalendarView }
  | { type: 'today' }
  | { type: 'step'; direction: 1 | -1 }
  | { type: 'create' }
  | { type: 'edit' }
  | { type: 'delete' }
  | { type: 'search' }
  | { type: 'escape' }

type Keys = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>

/**
 * Google Calendar's single-key shortcuts. `n` is left out on purpose: it adds a
 * task everywhere in Sype, so only `j` steps forward (`k` and `p` step back).
 * Any modifier, or typing in a field, turns them off, except Escape.
 */
export function resolveShortcut(e: Keys, typing: boolean): CalendarShortcut | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return null
  if (e.key === 'Escape') return { type: 'escape' }
  if (typing) return null

  const view = VIEWS.find((entry) => entry.key === e.key)
  if (view) return { type: 'view', view: view.view }
  switch (e.key) {
    case 't': return { type: 'today' }
    case 'j': return { type: 'step', direction: 1 }
    case 'k':
    case 'p': return { type: 'step', direction: -1 }
    case 'c': return { type: 'create' }
    case 'e': return { type: 'edit' }
    case 'Delete':
    case 'Backspace': return { type: 'delete' }
    case '/': return { type: 'search' }
    default: return null
  }
}

/** Ctrl+C opens or closes the chat, unless it is copying a selection or typing. */
export function shouldToggleChat(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
  typing: boolean,
  selectionText: string,
): boolean {
  return e.ctrlKey && e.key === 'c' && !e.metaKey && !e.altKey && !typing && selectionText === ''
}
