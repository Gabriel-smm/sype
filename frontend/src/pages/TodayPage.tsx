import DueChip from '../components/DueChip'
import FitFixes from '../components/FitFixes'
import { dueSoon, setupNeeded, todayAgenda } from '../lib/agenda'
import { typeColor } from '../lib/taskMeta'
import type { ReactNode } from 'react'

import { formatClock, hoursLabel } from '../lib/time'
import type { Schedule, ScheduleSlot, Settings, Task } from '../types/api'
import type { Fixes, Navigate, SlotAction } from '../types/app'

interface TodayPageProps {
  schedule: Schedule
  tasks: Task[]
  settings: Settings
  busy: boolean
  onComplete: SlotAction
  onSkip: SlotAction
  onOpenTask: (taskId: number) => void
  onNavigate: Navigate
  onCapture: () => void
  fixes: Fixes
}

const minutesBetween = (start: string, end: string) =>
  (new Date(end).getTime() - new Date(start).getTime()) / 60000

/**
 * The home screen: what to do now, what is left today, what is closing in,
 * and what needs a decision. Everything else is one tap away.
 */
export default function TodayPage({
  schedule, tasks, settings, busy, onComplete, onSkip, onOpenTask, onNavigate, onCapture, fixes,
}: TodayPageProps) {
  const now = new Date()
  const agenda = todayAgenda(schedule.slots, now)
  const soon = dueSoon(tasks, now)
  const focus = agenda.current ?? agenda.later[0] ?? null
  const rest = agenda.current ? agenda.later : agenda.later.slice(1)
  const minutesLeft = [agenda.current, ...agenda.later]
    .filter((slot): slot is ScheduleSlot => slot !== null)
    .reduce((sum, slot) => sum + minutesBetween(slot.start_time, slot.end_time), 0)

  const hasTasks = tasks.some((task) => task.status === 'pending')

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-8 px-4 py-6 md:px-6 md:py-8">
      <header>
        <p className="text-[12px] text-chalk-faint">
          {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="mt-0.5 font-display text-[26px] tracking-tight">
          {minutesLeft > 0
            ? `${hoursLabel(minutesLeft)} of work left today`
            : hasTasks ? 'Nothing else scheduled today' : 'A clear slate'}
        </h1>
      </header>

      {setupNeeded(settings) && <SetupCard onNavigate={onNavigate} />}

      {!hasTasks ? (
        <button
          type="button"
          onClick={onCapture}
          className="w-full rounded-xl border border-dashed border-ink-600 px-5 py-8 text-center
                     transition-colors hover:border-lamp/60"
        >
          <span className="block font-display text-[18px]">Add the first thing on your plate</span>
          <span className="mt-1 block text-[13px] text-chalk-faint">
            One line is enough — “bio reading tomorrow 1h”. Press <Kbd>n</Kbd> from anywhere.
          </span>
        </button>
      ) : (
        <FocusCard
          slot={focus}
          running={Boolean(agenda.current)}
          upcoming={agenda.upcoming}
          busy={busy}
          onComplete={onComplete}
          onSkip={onSkip}
          onOpenTask={onOpenTask}
        />
      )}

      <FitFixes items={schedule.unschedulable} busy={busy} defaultOpen {...fixes} />

      {agenda.earlier.length > 0 && (
        <Section title="Did you get to these?">
          <ul className="divide-y divide-ink-800/70">
            {agenda.earlier.map((slot) => (
              <SlotRow key={slot.id} slot={slot} onOpenTask={onOpenTask}>
                <SlotButtons slot={slot} busy={busy} onComplete={onComplete} onSkip={onSkip} small />
              </SlotRow>
            ))}
          </ul>
        </Section>
      )}

      {rest.length > 0 && (
        <Section title="Later today">
          <ul className="divide-y divide-ink-800/70">
            {rest.map((slot) => <SlotRow key={slot.id} slot={slot} onOpenTask={onOpenTask} />)}
          </ul>
        </Section>
      )}

      {soon.length > 0 && (
        <Section title="Due in the next three days">
          <ul className="divide-y divide-ink-800/70">
            {soon.map((task) => {
              const steps = task.subtasks ?? []
              const left = steps.filter((s) => s.status === 'pending').length
              return (
                <li key={task.id}>
                  <button type="button" onClick={() => onOpenTask(task.id)}
                          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left">
                    <span className="size-2 shrink-0 rounded-full"
                          style={{ background: typeColor(task.task_type) }} />
                    <span className="min-w-0 flex-1 truncate text-[14px]">{task.title}</span>
                    {task.grade_weight > 0 && (
                      <span className="text-[11.5px] text-chalk-faint tnum">{task.grade_weight}%</span>
                    )}
                    {steps.length > 0 && (
                      <span className="text-[11.5px] text-chalk-faint">
                        {left ? `${left} of ${steps.length} steps left` : 'all steps done'}
                      </span>
                    )}
                    <DueChip due={task.due_date} now={now} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-ink-600 bg-ink-800 px-1.5 py-px font-sans text-[11px] text-chalk-dim">
      {children}
    </kbd>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-[12px] text-chalk-faint">{title}</h2>
      {children}
    </section>
  )
}

function SetupCard({ onNavigate }: { onNavigate: Navigate }) {
  const steps = [
    ['busy', 'When you are busy', 'Sleep, classes, meals — so work never lands on them.'],
    ['focus', 'When you focus best', 'Essays and exam study only go here.'],
    ['routines', 'What repeats', 'Gym, laundry — optional.'],
  ]
  return (
    <section className="rounded-xl border border-ink-700 bg-ink-900 p-4">
      <h2 className="font-display text-[17px]">Tell the scheduler about your week</h2>
      <p className="mt-1 text-[13px] text-chalk-dim">
        Two minutes of setup, and the plan stops guessing.
      </p>
      <ol className="mt-3 space-y-1">
        {steps.map(([id, label, blurb], index) => (
          <li key={id}>
            <button type="button" onClick={() => onNavigate('setup', id)}
                    className="flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left
                               transition-colors hover:bg-ink-800">
              <span className="text-[12px] text-lamp tnum">{index + 1}</span>
              <span className="text-[13.5px]">{label}</span>
              <span className="text-[12px] text-chalk-faint max-sm:hidden">{blurb}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

interface FocusCardProps {
  slot: ScheduleSlot | null
  running: boolean
  upcoming: ScheduleSlot | null
  busy: boolean
  onComplete: SlotAction
  onSkip: SlotAction
  onOpenTask: (taskId: number) => void
}

function FocusCard({ slot, running, upcoming, busy, onComplete, onSkip, onOpenTask }: FocusCardProps) {
  if (!slot) {
    return (
      <section className="rounded-xl border border-ink-800 bg-ink-900 px-5 py-5">
        <h2 className="font-display text-[18px]">You are done for today</h2>
        <p className="mt-1 text-[13px] text-chalk-dim">
          {upcoming
            ? `Next up: ${upcoming.title}, ${new Date(upcoming.start_time).toLocaleDateString([], { weekday: 'long' })} at ${formatClock(new Date(upcoming.start_time))}.`
            : 'Nothing else is on the calendar.'}
        </p>
      </section>
    )
  }

  const color = typeColor(slot.task_type)
  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)

  return (
    <section
      className="rounded-xl border px-5 py-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, var(--color-ink-900))`,
      }}
    >
      <p className="text-[12px]" style={{ color }}>
        {running ? 'Now' : `Up next · starts ${formatClock(start)}`}
      </p>
      <button type="button" onClick={() => slot.task_id != null && onOpenTask(slot.task_id)} className="mt-1 block text-left">
        <h2 className="font-display text-[21px] leading-snug">{slot.title}</h2>
        {slot.parent_title && <p className="text-[13px] text-chalk-dim">{slot.parent_title}</p>}
      </button>
      <p className="mt-1 text-[13px] text-chalk-dim tnum">
        {formatClock(start)} – {formatClock(end)}
        <span className="text-chalk-faint"> · {hoursLabel(minutesBetween(slot.start_time, slot.end_time))}</span>
        {slot.requires_focus && <span className="text-chalk-faint"> · needs focus</span>}
      </p>
      <div className="mt-3">
        <SlotButtons slot={slot} busy={busy} onComplete={onComplete} onSkip={onSkip} />
      </div>
    </section>
  )
}

interface SlotRowProps {
  slot: ScheduleSlot
  onOpenTask: (taskId: number) => void
  children?: ReactNode
}

function SlotRow({ slot, onOpenTask, children }: SlotRowProps) {
  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-[92px] shrink-0 text-[12.5px] text-chalk-dim tnum">
        {formatClock(start)}–{formatClock(end)}
      </span>
      <span className="size-2 shrink-0 rounded-full" style={{ background: typeColor(slot.task_type) }} />
      <button type="button" onClick={() => slot.task_id != null && onOpenTask(slot.task_id)}
              className="min-w-0 flex-1 truncate text-left text-[14px]">
        {slot.title}
        {slot.parent_title && <span className="text-chalk-faint"> · {slot.parent_title}</span>}
      </button>
      {children}
    </li>
  )
}

/** Done / Skip for one scheduled session; a session is a step when it has a subtask. */
interface SlotButtonsProps {
  slot: ScheduleSlot
  busy: boolean
  onComplete: SlotAction
  onSkip: SlotAction
  small?: boolean
}

export function SlotButtons({ slot, busy, onComplete, onSkip, small }: SlotButtonsProps) {
  const id = (slot.subtask_id ?? slot.task_id)!
  const isSubtask = Boolean(slot.subtask_id)
  const size = small ? '!px-2 !py-0.5 !text-[11.5px]' : ''
  return (
    <span className="flex shrink-0 gap-2">
      <button type="button" className={small ? `btn-quiet ${size}` : 'btn-lamp'} disabled={busy}
              onClick={() => onComplete(id, isSubtask)}>
        Done
      </button>
      <button type="button" className={`btn-quiet ${size}`} disabled={busy}
              onClick={() => onSkip(id, isSubtask)}>
        Skip
      </button>
    </span>
  )
}
