import { describe, expect, it } from 'vitest'

import { COLOR_KEYS } from '@/types/api'
import { COLOR_HEX, COLOR_LABELS, eventLook, hexFor, slotColor, typeDefaultColor } from './colors'

describe('palette', () => {
  it('has a hex and a label for every key', () => {
    for (const key of COLOR_KEYS) {
      expect(COLOR_HEX[key]).toMatch(/^#[0-9a-f]{6}$/)
      expect(COLOR_LABELS[key].length).toBeGreaterThan(0)
    }
  })

  it('maps an unknown or missing key to stone', () => {
    expect(hexFor('chartreuse')).toBe(COLOR_HEX.stone)
    expect(hexFor(null)).toBe(COLOR_HEX.stone)
    expect(hexFor(undefined)).toBe(COLOR_HEX.stone)
    expect(hexFor('sky')).toBe(COLOR_HEX.sky)
  })
})

describe('slotColor', () => {
  it('prefers the slot colour key', () => {
    expect(slotColor({ color_key: 'rose', task_type: 'reading' })).toBe('rose')
  })

  it('falls back to the task type default', () => {
    expect(slotColor({ color_key: null, task_type: 'reading' })).toBe('sky')
    expect(typeDefaultColor('essay_project')).toBe('lilac')
    expect(typeDefaultColor('exam_study')).toBe('blush')
    expect(typeDefaultColor('problem_set')).toBe('mint')
    expect(typeDefaultColor('admin')).toBe('stone')
    expect(typeDefaultColor('other')).toBe('butter')
    expect(typeDefaultColor('routine')).toBe('peach')
    expect(typeDefaultColor('mystery')).toBe('stone')
  })
})

describe('eventLook', () => {
  it('lets routine win over busy', () => {
    expect(eventLook({ kind: 'routine', busy: true })).toBe('routine')
  })

  it('maps busy, free and task kinds', () => {
    expect(eventLook({ kind: 'default', busy: true })).toBe('busy')
    expect(eventLook({ kind: 'default', busy: false })).toBe('free')
  })
})
