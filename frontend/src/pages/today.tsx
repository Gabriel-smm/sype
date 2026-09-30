import { ArrowUpRight, CalendarClock, Clock, History, Plus, Rocket, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { SectionLabel } from '@/components/layout/section-label'
import { SlotButtons } from '@/components/schedule/slot-buttons'
import { DueChip } from '@/components/tasks/due-chip'
import { FitFixes } from '@/components/tasks/fit-fixes'
import { SubjectPill } from '@/components/tasks/subject-pill'
import { Kbd } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { useNow } from '@/hooks/use-now'
import { dueSoon, setupNeeded, todayAgenda } from '@/lib/agenda'
import { typeColor } from '@/lib/task-meta'
import { formatClock, hoursLabel } from '@/lib/time'
import type { Schedule, ScheduleSlot, Settings, Task } from '@/types/api'
import type { Fixes, SlotAction } from '@/types/app'

const minutesBetween = (start: string, end: string) =>
  (new Date(end).getTime() - new Date(start).getTime()) / 60000

interface TodayPageProps {
  schedule: Schedule
  tasks: Task[]
  settings: Settings
  busy: boolean
  onComplete: SlotAction
  onSkip: SlotAction
  onOpenTask: (taskId: number) => void
  onCapture: () => void
  fixes: Fixes
}

/**
 * Overview: what to do now, what is left today, what is closing in, and what
 * needs a decision, in one Sype card.
 */
export function TodayPage({
  schedule, tasks, settings, busy, onComplete, onSkip, onOpenTask, onCapture, fixes,
}: TodayPageProps) {
  const now = useNow(30_000)
  const agenda = todayAgenda(schedule.slots, now)
  const soon = dueSoon(tasks, now)
  const focus = agenda.current ?? agenda.later[0] ?? null
  const rest = agenda.current ? agenda.later : agenda.later.slice(1)
  const minutesLeft = [agenda.current, ...agenda.later]
    .filter((slot): slot is ScheduleSlot => slot !== null)
    .reduce((sum, slot) => sum + minutesBetween(slot.start_time, slot.end_time), 0)
  const hasTasks = tasks.some((task) => task.status === 'pending')
  const open = (slot: ScheduleSlot) => slot.task_id != null && onOpenTask(slot.task_id)
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Card className="h-full min-h-0 w-full pb-0">
      <CardHeader
        title="Overview"
        description={minutesLeft > 0 ? `${date}. ${hoursLabel(minutesLeft)} of work left today.` : date}
        actions={<Button size="sm" onClick={onCapture}><Plus className="size-3.5" />New task</Button>}
      />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        {setupNeeded(settings) && <SetupTile />}
        <FitFixes items={schedule.unschedulable} busy={busy} defaultOpen {...fixes} />

        {!hasTasks ? (
          <button
            type="button"
            onClick={onCapture}
            className="w-full rounded-lg border-2 border-dashed border-sidebar-border px-6 py-10 text-center transition-colors
                       hover:border-white/30 hover:bg-white/5"
          >
            <span className="block font-semibold">Add the first thing on your plate</span>
            <span className="mt-1 block text-xs text-sidebar-foreground/60">
              One line is enough: “bio reading tomorrow 1h”. Press <Kbd>N</Kbd> from anywhere.
            </span>
          </button>
        ) : (
          <NowTile slot={focus} now={now} running={Boolean(agenda.current)} upcoming={agenda.upcoming}
                   busy={busy} onComplete={onComplete} onSkip={onSkip} onOpen={open} />
        )}

        {agenda.earlier.length > 0 && (
          <section className="space-y-1.5">
            <SectionLabel icon={History} aside={agenda.earlier.length}>Did you get to these?</SectionLabel>
            <SlotList>
              {agenda.earlier.map((slot) => (
                <SlotRow key={slot.id} slot={slot} onOpen={open}>
                  <SlotButtons slot={slot} busy={busy} onComplete={onComplete} onSkip={onSkip} />
                </SlotRow>
              ))}
            </SlotList>
          </section>
        )}

        {rest.length > 0 && (
          <section className="space-y-1.5">
            <SectionLabel icon={Clock} aside={rest.length}>Later today</SectionLabel>
            <SlotList>{rest.map((slot) => <SlotRow key={slot.id} slot={slot} onOpen={open} />)}</SlotList>
          </section>
        )}

        <section className="space-y-1.5">
          <SectionLabel icon={CalendarClock} aside={soon.length || undefined}>Due in the next three days</SectionLabel>
          {soon.length === 0 ? (
            <p className="text-[11px] text-white/50">Nothing due soon.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {soon.map((task) => {
                const steps = task.subtasks ?? []
                const left = steps.filter((s) => s.status === 'pending').length
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="rounded-md border border-sidebar-border bg-sidebar/60 p-3 text-left transition-colors duration-200
                               hover:border-white/20 hover:bg-white/10"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <SubjectPill taskType={task.task_type} />
                      {task.grade_weight > 0 && <span className="text-[10px] text-white/50 tnum">{task.grade_weight}%</span>}
                    </span>
                    <span className="mt-1.5 mb-1.5 block truncate text-[11px] font-medium text-white">{task.title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <DueChip due={task.due_date} now={now} />
                      {steps.length > 0 && (
                        <span className="text-[9px] text-white/50">
                          {left ? `${left} of ${steps.length} steps left` : 'all steps done'}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </Card>
  )
}

function SetupTile() {
  const steps: [string, string][] = [
    ['busy', 'When you are busy'],
    ['focus', 'When you focus best'],
    ['routines', 'What repeats'],
  ]
  return (
    <section className="rounded-lg border border-blue-500/30 bg-sidebar/60 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
        <Rocket className="size-3.5 text-blue-400" />Tell the scheduler about your week
      </p>
      <p className="mt-1 text-xs text-white/60">Two minutes of setup, and the plan stops guessing.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {steps.map(([id, label]) => (
          <Link key={id} to={`/setup#${id}`}
                className="flex items-center gap-1 rounded-md border border-sidebar-border px-2.5 py-1 text-xs text-white/70
                           transition-colors hover:border-white/40 hover:text-white">
            {label}<ArrowUpRight className="size-3" />
          </Link>
        ))}
      </div>
    </section>
  )
}

interface NowTileProps {
  slot: ScheduleSlot | null
  now: Date
  running: boolean
  upcoming: ScheduleSlot | null
  busy: boolean
  onComplete: SlotAction
  onSkip: SlotAction
  onOpen: (slot: ScheduleSlot) => void
}

/** The session to work on now, in Sype's "High Hurdle" card, with a bar that fills as it runs. */
function NowTile({ slot, now, running, upcoming, busy, onComplete, onSkip, onOpen }: NowTileProps) {
  if (!slot) {
    return (
      <section className="rounded-lg border border-sidebar-border bg-sidebar/60 p-4">
        <h3 className="text-base font-semibold text-white">You are done for today</h3>
        <p className="mt-1 text-xs text-white/60">
          {upcoming
            ? `Next up: ${upcoming.title}, ${new Date(upcoming.start_time).toLocaleDateString([], { weekday: 'long' })} at ${formatClock(new Date(upcoming.start_time))}.`
            : 'Nothing else is on the calendar.'}
        </p>
      </section>
    )
  }

  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)
  const total = end.getTime() - start.getTime()
  const elapsed = running ? Math.min(Math.max((now.getTime() - start.getTime()) / total, 0), 1) : 0
  const minutesLeft = Math.max(Math.round((end.getTime() - now.getTime()) / 60000), 0)
  const startsIn = Math.max(Math.round((start.getTime() - now.getTime()) / 60000), 0)
  const color = typeColor(slot.task_type)

  return (
    <section
      className="relative rounded-lg border border-blue-500/30 bg-sidebar/60 p-4 transition-all duration-300 hover:border-blue-500/50"
      style={{ backgroundImage: 'radial-gradient(ellipse at center, transparent, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.06))' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <SubjectPill taskType={slot.task_type} />
        <span className="flex items-center gap-1 rounded-full bg-sidebar-accent px-2 py-1 text-[10px] text-white/70">
          <Sparkles className="size-3 text-purple-400" />
          {running ? `Now, ${hoursLabel(minutesLeft)} left` : `Up next, in ${hoursLabel(startsIn)}`}
        </span>
      </div>
      <button type="button" onClick={() => onOpen(slot)} className="block text-left">
        <h3 className="mb-1 text-base font-semibold text-white">{slot.title}</h3>
        <p className="mb-3 text-xs text-white/60">
          {slot.parent_title ? `Part of ${slot.parent_title} • ` : ''}{formatClock(start)} – {formatClock(end)}
          {slot.requires_focus ? ' • Needs focus' : ''}
        </p>
      </button>
      <div
        className="mb-3 h-1 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(elapsed * 100)}
      >
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${elapsed * 100}%`, background: color }} />
      </div>
      <SlotButtons slot={slot} busy={busy} onComplete={onComplete} onSkip={onSkip} />
    </section>
  )
}

function SlotList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-1">{children}</ul>
}

function SlotRow({ slot, onOpen, children }: { slot: ScheduleSlot; onOpen: (slot: ScheduleSlot) => void; children?: ReactNode }) {
  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)
  return (
    <li className="flex min-h-12 items-center gap-3 rounded-md border border-sidebar-border bg-sidebar/40 px-3 py-2 transition-colors
                   duration-200 hover:border-white/20 hover:bg-white/10">
      <span className="shrink-0 text-[11px] whitespace-nowrap text-white/50 tnum sm:w-[120px]">
        {formatClock(start)}<span className="max-sm:hidden"> – {formatClock(end)}</span>
      </span>
      <button type="button" onClick={() => onOpen(slot)} className="min-w-0 flex-1 truncate text-left text-[11px] text-white">
        {slot.title}
        {slot.parent_title && <span className="text-white/40">, {slot.parent_title}</span>}
      </button>
      <SubjectPill taskType={slot.task_type} />
      {children}
    </li>
  )
}
