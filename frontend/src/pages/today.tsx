import { ArrowUpRight, CalendarClock, Plus, Rocket } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Reveal } from '@/components/effects/reveal'
import { IconTile, PageHeader, SectionTitle } from '@/components/layout/page-header'
import { SlotButtons } from '@/components/schedule/slot-buttons'
import { DueChip } from '@/components/tasks/due-chip'
import { FitFixes } from '@/components/tasks/fit-fixes'
import { Kbd } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { useNow } from '@/hooks/use-now'
import { dueSoon, setupNeeded, todayAgenda } from '@/lib/agenda'
import { typeColor, typeLabel } from '@/lib/task-meta'
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
 * The home screen: what to do now, what is left today, what is closing in,
 * and what needs a decision. Everything else is one tap away.
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

  const [title, accent] = minutesLeft > 0
    ? [`${hoursLabel(minutesLeft)} of work`, 'left today']
    : hasTasks ? ['Nothing else', 'scheduled today'] : ['A clear', 'slate']

  return (
    <div className="space-y-16">
      <PageHeader
        badge={now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        title={title}
        accent={accent}
      />

      {schedule.unschedulable.length > 0 && (
        <Reveal delay={0.6}>
          <FitFixes items={schedule.unschedulable} busy={busy} defaultOpen {...fixes} />
        </Reveal>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-16">
          {!hasTasks ? (
            <button
              type="button"
              onClick={onCapture}
              className="group w-full rounded-3xl border border-dashed border-white/15 px-8 py-14 text-center
                         transition-colors hover:border-accent-ink/50 hover:bg-white/[0.02]"
            >
              <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-white/[0.06] text-accent-ink
                               transition-colors group-hover:bg-primary group-hover:text-white">
                <Plus className="size-5" />
              </span>
              <span className="block text-xl font-semibold tracking-tight">Add the first thing on your plate</span>
              <span className="mt-2 block text-sm text-muted-foreground">
                One line is enough: “bio reading tomorrow 1h”. Press <Kbd>N</Kbd> from anywhere.
              </span>
            </button>
          ) : (
            <Reveal delay={0.6}>
              <FocusCard
                slot={focus}
                now={now}
                running={Boolean(agenda.current)}
                upcoming={agenda.upcoming}
                busy={busy}
                onComplete={onComplete}
                onSkip={onSkip}
                onOpen={open}
              />
            </Reveal>
          )}

          {agenda.earlier.length > 0 && (
            <section>
              <SectionTitle>Did you get to these?</SectionTitle>
              <SlotList>
                {agenda.earlier.map((slot) => (
                  <SlotRow key={slot.id} slot={slot} onOpen={open}>
                    <SlotButtons slot={slot} busy={busy} onComplete={onComplete} onSkip={onSkip} small />
                  </SlotRow>
                ))}
              </SlotList>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <SectionTitle aside={rest.length}>Later today</SectionTitle>
              <SlotList>
                {rest.map((slot) => <SlotRow key={slot.id} slot={slot} onOpen={open} />)}
              </SlotList>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          {setupNeeded(settings) && <Reveal delay={0.6}><SetupCard /></Reveal>}

          <Reveal delay={0.7}>
          <GlassCard hoverEffect className="p-0">
            <div className="px-8 pt-8 pb-4">
              <IconTile><CalendarClock /></IconTile>
              <h2 className="mt-6 flex items-baseline gap-3 text-2xl font-semibold">
                Due in the next three days
                {soon.length > 0 && <span className="ml-auto text-sm font-normal text-white/40 tnum">{soon.length}</span>}
              </h2>
            </div>
            {soon.length === 0 ? (
              <p className="px-8 pb-8 text-white/60">Nothing due soon.</p>
            ) : (
              <ul className="relative px-4 pb-4">
                {soon.map((task) => {
                  const steps = task.subtasks ?? []
                  const left = steps.filter((s) => s.status === 'pending').length
                  return (
                    <li key={task.id}>
                      <button type="button" onClick={() => onOpenTask(task.id)}
                              className="flex w-full flex-col gap-1.5 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">
                        <span className="flex w-full items-center gap-2.5">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: typeColor(task.task_type) }} />
                          <span className="min-w-0 flex-1 truncate text-[15px]">{task.title}</span>
                          {task.grade_weight > 0 && (
                            <span className="text-xs text-faint tnum">{task.grade_weight}%</span>
                          )}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 pl-[18px]">
                          <DueChip due={task.due_date} now={now} />
                          {steps.length > 0 && (
                            <span className="text-xs text-faint">
                              {left ? `${left} of ${steps.length} steps left` : 'all steps done'}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </GlassCard>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

function SetupCard() {
  const steps: [string, string, string][] = [
    ['busy', 'When you are busy', 'Sleep, classes, meals, so work never lands on them.'],
    ['focus', 'When you focus best', 'Essays and exam study only go here.'],
    ['routines', 'What repeats', 'Gym, laundry. Optional.'],
  ]
  return (
    <GlassCard hoverEffect className="border-blue-400/25">
      <IconTile><Rocket /></IconTile>
      <h2 className="mt-6 text-2xl font-semibold">Tell the scheduler about your week</h2>
      <p className="mt-2 leading-relaxed text-white/60">Two minutes of setup, and the plan stops guessing.</p>
      <ol className="mt-4 space-y-1">
        {steps.map(([id, label, blurb], index) => (
          <li key={id}>
            <Link to={`/setup#${id}`}
                  className="group flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/[0.05]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/20 text-xs text-accent-ink tnum">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{label}</span>
                <span className="block text-xs text-faint">{blurb}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-faint transition-colors group-hover:text-foreground" />
            </Link>
          </li>
        ))}
      </ol>
    </GlassCard>
  )
}

interface FocusCardProps {
  slot: ScheduleSlot | null
  now: Date
  running: boolean
  upcoming: ScheduleSlot | null
  busy: boolean
  onComplete: SlotAction
  onSkip: SlotAction
  onOpen: (slot: ScheduleSlot) => void
}

/**
 * The one loud thing in the app: the session to work on right now, with a
 * needle that fills as it runs, lit from behind by Sype's blue glow.
 */
function FocusCard({ slot, now, running, upcoming, busy, onComplete, onSkip, onOpen }: FocusCardProps) {
  if (!slot) {
    return (
      <GlassCard className="p-10">
        <h2 className="text-4xl font-bold tracking-tight">You are done <span className="text-gradient">for today</span></h2>
        <p className="mt-2 text-muted-foreground">
          {upcoming
            ? `Next up: ${upcoming.title}, ${new Date(upcoming.start_time).toLocaleDateString([], { weekday: 'long' })} at ${formatClock(new Date(upcoming.start_time))}.`
            : 'Nothing else is on the calendar.'}
        </p>
      </GlassCard>
    )
  }

  const color = typeColor(slot.task_type)
  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)
  const total = end.getTime() - start.getTime()
  const elapsed = running ? Math.min(Math.max((now.getTime() - start.getTime()) / total, 0), 1) : 0
  const minutesLeft = Math.max(Math.round((end.getTime() - now.getTime()) / 60000), 0)
  const startsIn = Math.max(Math.round((start.getTime() - now.getTime()) / 60000), 0)

  return (
    <div className="relative">
      <div aria-hidden="true"
           className="pointer-events-none absolute -inset-6 -z-10 animate-blob rounded-full bg-blue-600/30 blur-[100px]
                      motion-reduce:animate-none" />
      <GlassCard className="bg-white/[0.05] p-8 md:p-10">
        <p className="flex items-center gap-2 text-sm text-accent-ink">
          {running && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-ink opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-accent-ink" />
            </span>
          )}
          {running ? 'Now' : `Up next, in ${hoursLabel(startsIn)}`}
        </p>

        <button type="button" onClick={() => onOpen(slot)} className="mt-3 block text-left">
          <h2 className="text-4xl leading-tight font-bold tracking-tight text-balance md:text-5xl">{slot.title}</h2>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: color }} />
              {slot.parent_title ?? typeLabel(slot.task_type)}
            </span>
            {slot.requires_focus && <span className="text-faint">Needs focus</span>}
          </span>
        </button>

        <div className="mt-8">
          <div
            className="relative h-1.5 rounded-full bg-white/10"
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(elapsed * 100)}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700"
                 style={{ width: `${elapsed * 100}%` }} />
            {running && (
              <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white
                              bg-primary shadow-[0_0_16px_rgba(59,130,246,0.9)]"
                   style={{ left: `${elapsed * 100}%` }} />
            )}
          </div>
          <div className="mt-2.5 flex justify-between text-sm text-faint tnum">
            <span>{formatClock(start)}</span>
            {running && <span className="text-muted-foreground">{hoursLabel(minutesLeft)} left</span>}
            <span>{formatClock(end)}</span>
          </div>
        </div>

        <div className="mt-7">
          <SlotButtons slot={slot} busy={busy} onComplete={onComplete} onSkip={onSkip} />
        </div>
      </GlassCard>
    </div>
  )
}

function SlotList({ children }: { children: ReactNode }) {
  return <ul className="glass divide-y divide-white/[0.06] overflow-hidden rounded-3xl">{children}</ul>
}

function SlotRow({ slot, onOpen, children }: { slot: ScheduleSlot; onOpen: (slot: ScheduleSlot) => void; children?: ReactNode }) {
  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="shrink-0 text-[13px] whitespace-nowrap text-muted-foreground tnum sm:w-[136px]">
        {formatClock(start)}<span className="max-sm:hidden">–{formatClock(end)}</span>
      </span>
      <span className="size-2 shrink-0 rounded-full" style={{ background: typeColor(slot.task_type) }} />
      <button type="button" onClick={() => onOpen(slot)} className="min-w-0 flex-1 truncate text-left text-[15px]">
        {slot.title}
        {slot.parent_title && <span className="text-faint">, {slot.parent_title}</span>}
      </button>
      {children}
    </li>
  )
}
