import { describe, expect, it } from 'vitest'

import { resolveShortcut, shouldToggleChat } from './shortcuts'

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}) => ({
  key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods,
})

describe('resolveShortcut', () => {
  it.each([
    ['d', 'day'], ['x', '3day'], ['w', 'week'], ['m', 'month'], ['a', 'schedule'],
  ] as const)('%s switches to the %s view', (k, view) => {
    expect(resolveShortcut(key(k), false)).toEqual({ type: 'view', view })
  })

  it('t goes to today', () => {
    expect(resolveShortcut(key('t'), false)).toEqual({ type: 'today' })
  })

  it('j steps forward, k and p step back', () => {
    expect(resolveShortcut(key('j'), false)).toEqual({ type: 'step', direction: 1 })
    expect(resolveShortcut(key('k'), false)).toEqual({ type: 'step', direction: -1 })
    expect(resolveShortcut(key('p'), false)).toEqual({ type: 'step', direction: -1 })
  })

  it('leaves n to the app, where it adds a task', () => {
    expect(resolveShortcut(key('n'), false)).toBeNull()
  })

  it('maps create, edit, search and escape', () => {
    expect(resolveShortcut(key('c'), false)).toEqual({ type: 'create' })
    expect(resolveShortcut(key('e'), false)).toEqual({ type: 'edit' })
    expect(resolveShortcut(key('/'), false)).toEqual({ type: 'search' })
    expect(resolveShortcut(key('Escape'), false)).toEqual({ type: 'escape' })
  })

  it('Delete and Backspace both delete', () => {
    expect(resolveShortcut(key('Delete'), false)).toEqual({ type: 'delete' })
    expect(resolveShortcut(key('Backspace'), false)).toEqual({ type: 'delete' })
  })

  it('ignores keys with no meaning', () => {
    expect(resolveShortcut(key('q'), false)).toBeNull()
    expect(resolveShortcut(key('Enter'), false)).toBeNull()
  })

  it.each(['ctrlKey', 'metaKey', 'altKey', 'shiftKey'] as const)('%s blocks every shortcut', (mod) => {
    for (const k of ['d', 'w', 't', 'j', 'c', 'e', '/', 'Delete', 'Escape']) {
      expect(resolveShortcut(key(k, { [mod]: true }), false)).toBeNull()
    }
  })

  it('treats an uppercase letter (Caps Lock) as no shortcut', () => {
    expect(resolveShortcut(key('W'), false)).toBeNull()
  })

  it('while typing, only Escape gets through', () => {
    for (const k of ['d', 'x', 'w', 'm', 'a', 't', 'j', 'k', 'p', 'c', 'e', '/', 'Delete', 'Backspace']) {
      expect(resolveShortcut(key(k), true)).toBeNull()
    }
    expect(resolveShortcut(key('Escape'), true)).toEqual({ type: 'escape' })
  })
})

describe('shouldToggleChat', () => {
  const ctrlC = key('c', { ctrlKey: true })

  it('is true for a plain Ctrl+C with nothing selected', () => {
    expect(shouldToggleChat(ctrlC, false, '')).toBe(true)
  })

  it('is false with text selected, so copying still works', () => {
    expect(shouldToggleChat(ctrlC, false, 'Essay draft')).toBe(false)
  })

  it('is false with meta or alt held', () => {
    expect(shouldToggleChat(key('c', { ctrlKey: true, metaKey: true }), false, '')).toBe(false)
    expect(shouldToggleChat(key('c', { ctrlKey: true, altKey: true }), false, '')).toBe(false)
  })

  it('is false while typing', () => {
    expect(shouldToggleChat(ctrlC, true, '')).toBe(false)
  })

  it('is false without Ctrl, or for another key', () => {
    expect(shouldToggleChat(key('c'), false, '')).toBe(false)
    expect(shouldToggleChat(key('v', { ctrlKey: true }), false, '')).toBe(false)
  })
})
