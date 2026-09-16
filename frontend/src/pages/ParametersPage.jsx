import { useEffect, useMemo, useRef, useState } from 'react'

import WeekStrip from '../components/WeekStrip'
import { api } from '../api'
import { BLOCK_KIND_LABELS, dueLabel, typeColor } from '../lib/taskMeta'
import { DAY_NAMES } from '../lib/time'

const SECTIONS = [
  ['ranking', 'What comes first'],
  ['busy', 'When you are busy'],
  ['focus', 'When you focus best'],
  ['activity', 'What you have done'],
]

const SLIDERS = [
  ['w_urgency', 'A deadline getting close', 'How hard a near deadline pulls work forward.'],
  ['w_grade', 'How much the grade rides on it', 'How much a heavy assessment outranks a light one.'],
  ['w_stress', 'How much it is weighing on you', 'How much your own stress rating counts.'],
  ['w_effort_gap', 'How much is still untouched', 'How much work you have not started outranks work already begun.'],
]

const SLIDER_COLORS = ['#e8b04b', '#7c93e8', '#e05a5a', '#5fb3a3']

export default function ParametersPage({ settings, events, busy, actions }) {
  const [active, setActive] = useState('ranking')
  const panes = useRef({})

  // Light the index entry for whichever section is in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length) setActive(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -70% 0px' },
    )
    Object.values(panes.current).forEach((node) => node && observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const register = (key) => (node) => { panes.current[key] = node }

  return (
    <div className="mx-auto flex w-full max-w-[1000px] gap-8 px-4 py-6 md:px-6 md:py-8">
      <nav aria-label="Sections on this page" className="sticky top-8 hidden h-fit w-40 shrink-0 lg:block">
        <ul className="space-y-0.5 border-l border-ink-800">
          {SECTIONS.map(([key, label]) => (
            <li key={key}>
              <a
                href={`#${key}`}
                className={`-ml-px block border-l py-1.5 pl-3 text-[12.5px] transition-colors ${
                  active === key
                    ? 'border-lamp text-chalk'
                    : 'border-transparent text-chalk-faint hover:text-chalk-dim'
                }`}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 space-y-12">
        <header>
          <h1 className="font-display text-[24px] tracking-tight">Parameters</h1>
          <p className="mt-1 text-[13px] text-chalk-dim">
            Everything the scheduler knows about you. None of it is learned yet — you set it all
            by hand.
          </p>
        </header>

        <Section id="ranking" title="What comes first" ref={register('ranking')}
                 blurb="Four things decide the order your work is scheduled in. These weights say how loudly each one speaks.">
          <Weights weights={settings.weights} busy={busy} onSave={actions.saveWeights} />
        </Section>

        <Section id="busy" title="When you are busy" ref={register('busy')}
                 blurb="Sleep, meals and classes. The scheduler never puts work inside these.">
          <WeekStrip
            blocks={settings.fixed_blocks}
            tint="#8a93a8"
            addLabel="a busy stretch"
            busy={busy}
            onAdd={actions.addFixedBlock}
            onDelete={actions.deleteFixedBlock}
          />
          <BlockList blocks={settings.fixed_blocks} onDelete={actions.deleteFixedBlock} withKind />
        </Section>

        <Section id="focus" title="When you focus best" ref={register('focus')}
                 blurb="Work that needs concentration — essay drafting, exam study — is only ever placed inside these hours.">
          <WeekStrip
            blocks={settings.productive_hours}
            tint="#e8b04b"
            addLabel="a stretch where you focus well"
            busy={busy}
            onAdd={actions.addProductiveWindow}
            onDelete={actions.deleteProductiveWindow}
          />
          <BlockList blocks={settings.productive_hours} onDelete={actions.deleteProductiveWindow} />
        </Section>

        <Section id="activity" title="What you have done" ref={register('activity')}
                 blurb="Every reschedule, skip and completion is recorded. Nothing reads it yet — it is the raw material for personalising this later.">
          <Activity events={events} />
        </Section>
      </div>
    </div>
  )
}

function Section({ id, title, blurb, children, ref }) {
  return (
    <section id={id} ref={ref} className="scroll-mt-8">
      <h2 className="font-display text-[18px]">{title}</h2>
      <p className="mt-1 mb-4 max-w-[62ch] text-[13px] leading-relaxed text-chalk-dim">{blurb}</p>
      {children}
    </section>
  )
}

function Weights({ weights, busy, onSave }) {
  const [draft, setDraft] = useState(weights)
  const [preview, setPreview] = useState(null)
  const [saved, setSaved] = useState(false)
  const [serverWeights, setServerWeights] = useState(weights)

  // Adopt fresh settings from the server during render rather than in an
  // effect, so the sliders never paint a stale position first.
  if (serverWeights !== weights) {
    setServerWeights(weights)
    setDraft(weights)
  }

  const dirty = SLIDERS.some(([key]) => Number(draft[key]) !== Number(weights[key]))
  const total = SLIDERS.reduce((sum, [key]) => sum + Number(draft[key]), 0)

  const asNumbers = useMemo(
    () => Object.fromEntries(SLIDERS.map(([key]) => [key, Number(draft[key])])),
    [draft],
  )

  // Rank with the server's own scoring rather than a copy of the formula here.
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      api.previewWeights(asNumbers, 3)
        .then((result) => live && setPreview(result))
        .catch(() => live && setPreview(null))
    }, 180)
    return () => { live = false; clearTimeout(timer) }
  }, [asNumbers])

  async function save() {
    await onSave(asNumbers)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-800" role="img"
             aria-label="The mix of the four weights">
          {SLIDERS.map(([key], index) => {
            const share = total > 0 ? (Number(draft[key]) / total) * 100 : 25
            return (
              <span key={key} style={{ width: `${share}%`, background: SLIDER_COLORS[index] }}
                    className="transition-[width] duration-150" />
            )
          })}
        </div>
        <p className="mt-1.5 text-[11.5px] text-chalk-faint">
          Only the proportions matter — they do not have to add up to anything.
        </p>
      </div>

      <div className="space-y-4">
        {SLIDERS.map(([key, label, blurb], index) => (
          <div key={key}>
            <div className="flex items-baseline gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: SLIDER_COLORS[index] }} />
              <span className="text-[13.5px]">{label}</span>
              <span className="ml-auto text-[12px] text-chalk-dim tnum">
                {Number(draft[key]).toFixed(2)}
              </span>
            </div>
            <input
              type="range" min="0" max="1" step="0.05" className="slider-lamp"
              aria-label={label}
              value={draft[key]}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
            <p className="-mt-0.5 ml-4 text-[12px] text-chalk-faint">{blurb}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-900 p-3.5">
        <h3 className="text-[12px] text-chalk-faint">With these settings, you would work on</h3>
        {preview === null ? (
          <p className="mt-2 text-[13px] text-chalk-faint">Working it out…</p>
        ) : preview.ranked.length === 0 ? (
          <p className="mt-2 text-[13px] text-chalk-faint">
            Nothing yet — add a task and this fills in.
          </p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {preview.ranked.map((item, index) => (
              <li key={`${item.task_id}-${item.subtask_id}`}
                  className="flex items-baseline gap-2.5 text-[13px]">
                <span className="w-3 shrink-0 text-chalk-faint tnum">{index + 1}</span>
                <span className="size-1.5 shrink-0 translate-y-[-1px] rounded-full"
                      style={{ background: typeColor(item.task_type) }} />
                <span className="truncate">{item.title}</span>
                {item.parent_title && (
                  <span className="truncate text-chalk-faint">{item.parent_title}</span>
                )}
                <span className="ml-auto shrink-0 text-chalk-faint tnum">
                  {dueLabel(item.due_date)}
                </span>
              </li>
            ))}
          </ol>
        )}
        {preview?.total_pending > preview?.ranked.length && (
          <p className="mt-2 text-[11.5px] text-chalk-faint">
            and {preview.total_pending - preview.ranked.length} more after that
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-lamp" onClick={save} disabled={busy || !dirty}>
          Save
        </button>
        {saved && <span className="text-[12.5px] text-type-problem">Saved</span>}
        {!saved && dirty && (
          <span className="text-[12.5px] text-chalk-faint">
            Not saved yet — the calendar keeps the old ordering until you do.
          </span>
        )}
      </div>
    </div>
  )
}

function BlockList({ blocks, onDelete, withKind }) {
  if (!blocks.length) {
    return <p className="mt-3 text-[13px] text-chalk-faint">Nothing set yet.</p>
  }

  return (
    <ul className="mt-3 divide-y divide-ink-800 text-[13px]">
      {blocks.map((block) => (
        <li key={block.id} className="group flex items-center gap-3 py-2">
          <span className="w-24 shrink-0 truncate">
            {block.label || (withKind ? BLOCK_KIND_LABELS[block.kind] : 'Focus time')}
          </span>
          <span className="w-20 shrink-0 text-chalk-dim">
            {block.day_of_week === null ? 'Every day' : DAY_NAMES[block.day_of_week]}
          </span>
          <span className="text-chalk-dim tnum">{block.start_time}–{block.end_time}</span>
          {block.end_time <= block.start_time && (
            <span className="text-[11.5px] text-chalk-faint">overnight</span>
          )}
          <button
            type="button"
            onClick={() => onDelete(block.id)}
            className="ml-auto text-[12px] text-chalk-faint opacity-0 transition-opacity
                       group-hover:opacity-100 hover:text-alarm focus-visible:opacity-100"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}

const EVENT_COLORS = {
  completed: '#5fb3a3',
  skipped: '#e05a5a',
  rescheduled: '#7c93e8',
  unschedulable: '#e8b04b',
  created: '#8a93a8',
  scheduled: '#8a93a8',
}

const EVENT_WORDS = {
  completed: 'finished',
  skipped: 'skipped',
  rescheduled: 'moved',
  unschedulable: 'could not be placed',
  created: 'added',
  scheduled: 'placed on the calendar',
}

function Activity({ events }) {
  const [open, setOpen] = useState(false)

  if (!events.length) {
    return <p className="text-[13px] text-chalk-faint">Nothing recorded yet.</p>
  }

  const shown = open ? events : events.slice(0, 6)

  return (
    <div>
      <ul className="space-y-2 text-[13px]">
        {shown.map((event) => {
          const color = EVENT_COLORS[event.event_type] ?? '#8a93a8'
          return (
            <li key={event.id} className="flex items-baseline gap-2.5">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
              <span style={{ color }}>{EVENT_WORDS[event.event_type] ?? event.event_type}</span>
              <span className="text-chalk-dim">
                {event.subtask_id ? `step ${event.subtask_id}` : `task ${event.task_id ?? '—'}`}
              </span>
              <span className="ml-auto shrink-0 text-chalk-faint tnum">
                {new Date(`${event.timestamp}Z`).toLocaleString([], {
                  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </li>
          )
        })}
      </ul>
      {events.length > 6 && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-3 text-[12px] text-chalk-faint transition-colors hover:text-chalk-dim"
        >
          {open ? 'Show fewer' : `Show all ${events.length}`}
        </button>
      )}
    </div>
  )
}
