// The time grid's pointer gestures: drag-create on empty space, move an event or
// task block, resize one from its bottom edge. One pointer at a time, captured on
// the element it started on. A press that travels under 4px is a click.
// All time maths goes through lib/drag.ts.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

import { startOfDay } from 'date-fns'

import {
  SNAP, applyMove, applyResize, clampEndToDay, clampMoveToDay, normaliseCreate, yToMinute,
} from '@/lib/drag'
import { MINUTES_IN_DAY, isSameDay, minutesSinceMidnight } from '@/lib/time'
import type { Occurrence, ScheduleSlot } from '@/types/api'

const CLICK_TOLERANCE = 4

export type DragTarget =
  | { kind: 'event'; occurrence: Occurrence }
  | { kind: 'slot'; slot: ScheduleSlot }

export type GesturePreview =
  | { type: 'create'; dayIndex: number; start: Date; end: Date }
  | { type: 'move' | 'resize'; target: DragTarget; start: Date; end: Date }

interface Options {
  days: Date[]
  hourHeight: number
  /** The row of day columns (no gutter): pointer x/y are measured against it. */
  columns: RefObject<HTMLElement | null>
  onClick: (target: DragTarget, anchor: HTMLElement) => void
  onCreate: (start: Date, end: Date, anchor: DOMRect) => void
  onMove: (target: DragTarget, start: Date, end: Date) => void
  onResize: (target: DragTarget, start: Date, end: Date) => void
}

interface Pending {
  type: GesturePreview['type']
  target: DragTarget | null
  pointerId: number
  element: HTMLElement
  anchor: HTMLElement
  originX: number
  originY: number
  originDay: number
  /** Pointer offset from the top of the columns, in px (scroll-proof). */
  originTop: number
  moved: boolean
  preview: GesturePreview | null
}

const span = (target: DragTarget) =>
  target.kind === 'event'
    ? { start: new Date(target.occurrence.start), end: new Date(target.occurrence.end) }
    : { start: new Date(target.slot.start_time), end: new Date(target.slot.end_time) }

// The 15-minute slot a create press fell in.
const pressMinute = (current: Pending, hourHeight: number) =>
  Math.min(Math.floor(((current.originTop / hourHeight) * 60) / SNAP) * SNAP, MINUTES_IN_DAY - SNAP)

// Wall-clock minutes of a same-day range (an end at the next midnight counts as 1440).
const dayMinutes = (start: Date, end: Date) => ({
  from: minutesSinceMidnight(start),
  to: isSameDay(start, end) ? minutesSinceMidnight(end) : MINUTES_IN_DAY,
})

const samePreview = (a: GesturePreview | null, b: GesturePreview | null) =>
  a?.start.getTime() === b?.start.getTime() && a?.end.getTime() === b?.end.getTime()

export function useGridPointer(options: Options) {
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })

  const pending = useRef<Pending | null>(null)
  const [preview, setPreview] = useState<GesturePreview | null>(null)

  const release = useCallback(() => {
    const current = pending.current
    pending.current = null
    setPreview(null)
    if (current?.element.hasPointerCapture(current.pointerId)) {
      current.element.releasePointerCapture(current.pointerId)
    }
  }, [])

  // Esc abandons whatever is being dragged; capture phase so it wins over page shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !pending.current) return
      event.preventDefault()
      event.stopPropagation()
      release()
    }
    // If the captured element unmounts mid-drag (a refetch replaced it), nothing else would end the gesture.
    const onLost = (event: globalThis.PointerEvent) => {
      const current = pending.current
      if (current && current.pointerId === event.pointerId && !current.element.isConnected) release()
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('lostpointercapture', onLost)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('lostpointercapture', onLost)
    }
  }, [release])

  function geometry(clientX: number, clientY: number) {
    const { columns, days } = latest.current
    const rect = columns.current?.getBoundingClientRect()
    if (!rect) return null
    const width = rect.width / days.length
    const day = Math.min(Math.max(Math.floor((clientX - rect.left) / width), 0), days.length - 1)
    return { rect, width, day, top: clientY - rect.top }
  }

  function begin(
    event: PointerEvent<HTMLElement>, type: Pending['type'], target: DragTarget | null, anchor: HTMLElement,
  ) {
    if (pending.current && !pending.current.element.isConnected) release()
    if (event.button !== 0 || pending.current) return
    const at = geometry(event.clientX, event.clientY)
    if (!at) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    pending.current = {
      type, target, anchor,
      pointerId: event.pointerId,
      element: event.currentTarget,
      originX: event.clientX,
      originY: event.clientY,
      originDay: at.day,
      originTop: at.top,
      moved: false,
      preview: null,
    }
  }

  // Where the gesture would land if the pointer were released at (x, y).
  function compute(current: Pending, clientX: number, clientY: number): GesturePreview | null {
    const { days, hourHeight } = latest.current
    const at = geometry(clientX, clientY)
    if (!at) return null

    if (current.type === 'create') {
      // The press marks the slot it fell in; dragging extends from there, either way.
      const anchorMinute = pressMinute(current, hourHeight)
      const pointer = yToMinute(at.top, hourHeight)
      const [from, to] = pointer > anchorMinute ? [anchorMinute, pointer] : [pointer, anchorMinute + SNAP]
      const { start, end } = normaliseCreate(days[current.originDay], from, to)
      return { type: 'create', dayIndex: current.originDay, start, end }
    }

    const target = current.target as DragTarget
    const { start, end } = span(target)
    const minuteDelta = Math.round(((at.top - current.originTop) / hourHeight) * 60 / SNAP) * SNAP
    // Clamped to the day it is dropped on, so the drag never runs off the visible grid.
    if (current.type === 'move') {
      // The day is the column now under the grabbed part, which is always on screen.
      const moved = applyMove(start, end, at.day - current.originDay, minuteDelta)
      const overnight = !isSameDay(start, new Date(end.getTime() - 1))
      const holdBy = isSameDay(start, days[current.originDay]) ? 'start' : 'end'
      return { type: 'move', target, ...clampMoveToDay(moved.start, moved.end, days[at.day], { overnight, holdBy }) }
    }
    const resized = applyResize(start, end, minuteDelta)
    const endDay = startOfDay(new Date(end.getTime() - 1))
    return { type: 'resize', target, start: resized.start, end: clampEndToDay(resized.end, endDay) }
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const current = pending.current
    if (!current || current.pointerId !== event.pointerId) return
    if (!current.moved) {
      const travel = Math.hypot(event.clientX - current.originX, event.clientY - current.originY)
      if (travel < CLICK_TOLERANCE) return
      current.moved = true
    }
    const next = compute(current, event.clientX, event.clientY)
    if (!samePreview(next, current.preview)) {
      current.preview = next
      setPreview(next)
    }
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const current = pending.current
    if (!current || current.pointerId !== event.pointerId) return
    const result = current.moved ? compute(current, event.clientX, event.clientY) : null
    const { rect } = geometry(event.clientX, event.clientY) ?? {}
    release()
    const { days, hourHeight, onClick, onCreate, onMove, onResize } = latest.current

    if (current.type === 'create') {
      const minute = pressMinute(current, hourHeight)
      const draft = result ?? normaliseCreate(days[current.originDay], minute, minute)
      if (!rect) return
      // Anchor popovers to where the draft sits on screen.
      const width = rect.width / days.length
      const { from, to } = dayMinutes(draft.start, draft.end)
      onCreate(draft.start, draft.end, new DOMRect(
        rect.left + current.originDay * width,
        rect.top + (from / 60) * hourHeight,
        width,
        ((to - from) / 60) * hourHeight,
      ))
      return
    }

    const target = current.target as DragTarget
    if (!result) {
      onClick(target, current.anchor)
      return
    }
    const before = span(target)
    if (result.start.getTime() === before.start.getTime() && result.end.getTime() === before.end.getTime()) return
    if (current.type === 'move') onMove(target, result.start, result.end)
    else onResize(target, result.start, result.end)
  }

  // The browser took the pointer (a touch scroll, a system gesture): drop the gesture.
  function onPointerCancel(event: PointerEvent<HTMLElement>) {
    if (pending.current?.pointerId === event.pointerId) release()
  }

  return {
    preview,
    startCreate: (event: PointerEvent<HTMLElement>) =>
      begin(event, 'create', null, event.currentTarget),
    startMove: (event: PointerEvent<HTMLElement>, target: DragTarget) =>
      begin(event, 'move', target, event.currentTarget),
    startResize: (event: PointerEvent<HTMLElement>, target: DragTarget, chip: HTMLElement) =>
      begin(event, 'resize', target, chip),
    handlers: { onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture: onPointerCancel },
  }
}
