// The event palette: eleven pastels that are the only event hues in the app.
// Mirrors the --color-cat-* tokens in index.css.

import type { ColorKey, Occurrence, ScheduleSlot } from '@/types/api'

export const COLOR_HEX: Record<ColorKey, string> = {
  rose: '#f4a7b9',
  peach: '#f8b994',
  butter: '#f2dc8f',
  pistachio: '#c5e09b',
  mint: '#9fdcc0',
  aqua: '#93d8dc',
  sky: '#a3c4f3',
  periwinkle: '#b4b8f2',
  lilac: '#cdb4ee',
  blush: '#eab2d6',
  stone: '#c4c0b8',
}

export const COLOR_LABELS: Record<ColorKey, string> = {
  rose: 'Rose',
  peach: 'Peach',
  butter: 'Butter',
  pistachio: 'Pistachio',
  mint: 'Mint',
  aqua: 'Aqua',
  sky: 'Sky',
  periwinkle: 'Periwinkle',
  lilac: 'Lilac',
  blush: 'Blush',
  stone: 'Stone',
}

// Text on a solid pastel fill.
export const EVENT_INK = '#0a0f1a'

const TYPE_DEFAULTS: Record<string, ColorKey> = {
  essay_project: 'lilac',
  exam_study: 'blush',
  problem_set: 'mint',
  reading: 'sky',
  admin: 'stone',
  other: 'butter',
  routine: 'peach',
}

export function typeDefaultColor(taskType: string): ColorKey {
  return TYPE_DEFAULTS[taskType] ?? 'stone'
}

export function slotColor(slot: Pick<ScheduleSlot, 'color_key' | 'task_type'>): ColorKey {
  return slot.color_key ?? typeDefaultColor(slot.task_type)
}

export function hexFor(key: string | null | undefined): string {
  return (key != null && Object.hasOwn(COLOR_HEX, key) ? COLOR_HEX[key as ColorKey] : null) ?? COLOR_HEX.stone
}

export type EventLook = 'busy' | 'free' | 'routine' | 'task'

export function eventLook(o: Pick<Occurrence, 'kind' | 'busy'>): EventLook {
  if (o.kind === 'routine') return 'routine'
  return o.busy ? 'busy' : 'free'
}
