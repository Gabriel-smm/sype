import { useState } from 'react'

import Drawer from '../components/Drawer'
import WeekGrid from './calendar/WeekGrid'
import { formatClock, formatWeekRange, hoursLabel, weekStartOf } from '../lib/time'
import { typeColor, typeLabel } from '../lib/taskMeta'

function Chevron({ left }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={left ? 'M10 3l-5 5 5 5' : 'M6 3l5 5-5 5'} />
    </svg>
  )
}

export default function CalendarPage({
  schedule, settings, busy, onRegenerate, onMoveSlot, onComplete, onSkip,
}) {
  const [date, setDate] = useState(() => new Date())
  const [selected, setSelected] = useState(null)
  const [showMisses, setShowMisses] = useState(false)

  const shiftWeek = (weeks) => {
    const next = new Date(date)
    next.setDate(next.getDate() + weeks * 7)
    setDate(next)
  }

  const misses = schedule.unschedulable
  const thisWeek = weekStartOf(date).getTime() === weekStartOf(new Date()).getTime()

  return (
    <div className="flex h-full flex-col gap-3 p-4 md:p-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[22px] tracking-tight">{formatWeekRange(date)}</h1>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week"
                  className="rounded-md p-1.5 text-chalk-dim transition-colors hover:bg-ink-800 hover:text-chalk">
            <Chevron left />
          </button>
          <button type="button" onClick={() => shiftWeek(1)} aria-label="Next week"
                  className="rounded-md p-1.5 text-chalk-dim transition-colors hover:bg-ink-800 hover:text-chalk">
            <Chevron />
          </button>
          {!thisWeek && (
            <button type="button" className="btn-quiet ml-1" onClick={() => setDate(new Date())}>
              Today
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Legend />
          <button type="button" className="btn-lamp" onClick={onRegenerate} disabled={busy}>
            {busy ? 'Rebuilding…' : 'Rebuild schedule'}
          </button>
        </div>
      </header>

      {misses.length > 0 && (
        <section className="rounded-lg border border-lamp/25 bg-lamp/[0.06]">
          <button
            type="button"
            onClick={() => setShowMisses(!showMisses)}
            aria-expanded={showMisses}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-lamp"
          >
            <span className="rotate-0 transition-transform" style={{ transform: showMisses ? 'rotate(90deg)' : undefined }}>
              <Chevron />
            </span>
            {misses.length === 1
              ? 'One piece of work did not fit in your week'
              : `${misses.length} pieces of work did not fit in your week`}
          </button>
          {showMisses && (
            <ul className="space-y-1 px-3 pb-3 pl-9 text-[13px] text-chalk-dim">
              {misses.map((item) => (
                <li key={`${item.task_id}-${item.subtask_id}`}>
                  <span className="text-chalk">{item.title}</span>{' '}
                  <span className="text-chalk-faint">
                    needs {hoursLabel(item.estimated_duration)} — {item.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <WeekGrid
        slots={schedule.slots}
        fixedBlocks={settings.fixed_blocks}
        productiveHours={settings.productive_hours}
        date={date}
        selectedId={selected?.id}
        onSelectSlot={setSelected}
        onMoveSlot={onMoveSlot}
      />

      <Drawer open={Boolean(selected)} title={selected?.title ?? ''} onClose={() => setSelected(null)}>
        {selected && <SlotDetail slot={selected} onComplete={onComplete} onSkip={onSkip}
                                 onDone={() => setSelected(null)} />}
      </Drawer>
    </div>
  )
}

function Legend() {
  const items = [
    ['Your focus hours', <span key="a" className="block size-2.5 rounded-[2px] bg-lamp/25" />],
    ['Busy', <span key="b" className="hatched block size-2.5 rounded-[2px] border border-ink-700" />],
    ['Needs focus', <span key="c" className="block size-1.5 rounded-full bg-type-essay" />],
  ]
  return (
    <ul className="hidden items-center gap-3 text-[11px] text-chalk-faint lg:flex">
      {items.map(([label, swatch]) => (
        <li key={label} className="flex items-center gap-1.5">{swatch}{label}</li>
      ))}
    </ul>
  )
}

function SlotDetail({ slot, onComplete, onSkip, onDone }) {
  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)
  const color = typeColor(slot.task_type)

  const act = async (action) => {
    await action(slot.subtask_id ?? slot.task_id, Boolean(slot.subtask_id))
    onDone()
  }

  return (
    <div className="space-y-5 text-[13px]">
      <div>
        <div className="tnum text-chalk">
          {start.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div className="tnum text-chalk-dim">
          {formatClock(start)} – {formatClock(end)}
          <span className="text-chalk-faint"> ({hoursLabel((end - start) / 60000)})</span>
        </div>
      </div>

      {slot.parent_title && (
        <Fact label="Part of">
          <span className="rounded px-1.5 py-0.5"
                style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
            {slot.parent_title}
          </span>
        </Fact>
      )}

      <Fact label="Kind of work">{typeLabel(slot.task_type)}</Fact>

      <Fact label="Due">
        <span className={slot.overdue ? 'text-alarm' : ''}>
          {new Date(slot.due_date).toLocaleString([], {
            weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
          })}
          {slot.overdue && ' — already past'}
        </span>
      </Fact>

      <Fact label="Why it landed here">
        <span className="text-chalk-dim">
          Priority <span className="tnum text-chalk">{slot.priority_score.toFixed(2)}</span>
          {slot.requires_focus
            ? '. This needs concentration, so it was kept inside your focus hours.'
            : slot.in_productive_hours
              ? '. It happens to fall in your focus hours.'
              : '. It does not need deep focus, so any free time would do.'}
        </span>
      </Fact>

      <div className="flex gap-2 border-t border-ink-800 pt-4">
        <button type="button" className="btn-lamp"
                onClick={() => act((id, sub) => onComplete(id, sub))}>
          Mark done
        </button>
        <button type="button" className="btn-quiet"
                onClick={() => act((id, sub) => onSkip(id, sub))}>
          Skip it
        </button>
      </div>
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-chalk-faint">{label}</div>
      <div>{children}</div>
    </div>
  )
}
