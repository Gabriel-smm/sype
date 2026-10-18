import { addDays } from 'date-fns'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { AssignmentList } from '@/components/overview/assignment-list'
import { PriorityList } from '@/components/overview/priority-list'
import { TomorrowPlan } from '@/components/overview/tomorrow-plan'
import { WeekGlance } from '@/components/overview/week-glance'
import { FitFixes } from '@/components/tasks/fit-fixes'
import { Kbd } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useNow } from '@/hooks/use-now'
import { dayPlan, majorAssignments, setupNeeded, todayAgenda, topPriorities, weekSummary } from '@/lib/agenda'
import { formatClock, hoursLabel } from '@/lib/time'
import type { Schedule, ScheduleSlot, Settings, Task } from '@/types/api'
import type { Fixes, SlotAction } from '@/types/app'

// "Oct 18 – 24", or "Oct 29 – Nov 4" across a month boundary.
const dayRange = (first: Date, last: Date) => {
  const short = (day: Date) => day.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return `${short(first)} – ${first.getMonth() === last.getMonth() ? last.getDate() : short(last)}`
}

const minutesBetween = (start: string, end: string) =>
  (new Date(end).getTime() - new Date(start).getTime()) / 60000

interface TodayPageProps {
  schedule: Schedule
  tasks: Task[]
  settings: Settings
  busy: boolean
  onComplete: SlotAction
  onOpenTask: (taskId: number) => void
  onCapture: () => void
  fixes: Fixes
}

/**
 * Overview: the week at a glance. What matters most today, what tomorrow
 * looks like, the shape of the week, and the assignments that carry weight.
 * Colour is kept to thin type edges; blue marks only "now".
 */
export function TodayPage({ schedule, tasks, settings, busy, onComplete, onOpenTask, onCapture, fixes }: TodayPageProps) {
  const now = useNow(30_000)
  const { slots } = schedule
  const agenda = todayAgenda(slots, now)
  const priorities = topPriorities(slots, now)
  const tomorrow = addDays(now, 1)
  const tomorrowPlan = dayPlan(slots, tasks, tomorrow)
  const week = weekSummary(slots, tasks, now)
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0)
  const assignments = majorAssignments(tasks, now)
  const minutesLeft = [agenda.current, ...agenda.later]
    .filter((slot): slot is ScheduleSlot => slot !== null)
    .reduce((sum, slot) => sum + minutesBetween(slot.start_time, slot.end_time), 0)
  const hasTasks = tasks.some((task) => task.status === 'pending')
  const open = (slot: ScheduleSlot) => slot.task_id != null && onOpenTask(slot.task_id)

  return (
    <Card className="h-full min-h-0 w-full gap-0 py-0">
      <header className="flex flex-shrink-0 flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </h1>
          <p className="mt-0.5 text-[13px] text-white/50 tnum">
            {minutesLeft > 0 ? `${hoursLabel(minutesLeft)} of work left today` : 'Nothing left today'}
          </p>
        </div>
        <Button size="sm" onClick={onCapture}><Plus className="size-3.5" />New task</Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {(setupNeeded(settings) || schedule.unschedulable.length > 0) && (
          <div className="mb-5 space-y-2">
            {setupNeeded(settings) && <SetupNote />}
            <FitFixes items={schedule.unschedulable} busy={busy} {...fixes} />
          </div>
        )}

        {!hasTasks ? (
          <div className="py-10">
            <p className="text-[15px] text-white">Add the first thing on your plate.</p>
            <p className="mt-1 text-[13px] text-white/50">
              One line is enough: “bio reading tomorrow 1h”. Press <Kbd>N</Kbd> from anywhere.
            </p>
            <Button size="sm" className="mt-4" onClick={onCapture}><Plus className="size-3.5" />New task</Button>
          </div>
        ) : (
          <>
            <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
              <Section title="Today">
                <PriorityList slots={priorities.top} more={priorities.more} now={now} busy={busy}
                              onComplete={onComplete} onOpen={open} />
              </Section>
              <Section
                title={`Tomorrow, ${tomorrow.toLocaleDateString([], { weekday: 'long' })}`}
                aside={tomorrowPlan.slots.length > 0
                  && `${hoursLabel(tomorrowPlan.minutes)} from ${formatClock(new Date(tomorrowPlan.slots[0].start_time))}`}
                className="lg:border-l lg:border-white/[0.06] lg:pl-10"
              >
                <TomorrowPlan plan={tomorrowPlan} onOpen={open} />
              </Section>
            </div>

            <Section title="The week ahead" aside={`${dayRange(week[0].day, week[6].day)}${weekMinutes ? `, ${hoursLabel(weekMinutes)} of work` : ''}`}
                     className="mt-7 border-t border-white/[0.06] pt-6">
              <WeekGlance week={week} slots={slots} fixedBlocks={settings.fixed_blocks} now={now} />
            </Section>

            <Section title="Major assignments" className="mt-7 border-t border-white/[0.06] pt-6">
              <AssignmentList items={assignments} now={now} onOpen={onOpenTask} />
            </Section>
          </>
        )}
      </div>
    </Card>
  )
}

function Section({ title, aside, className, children }: {
  title: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-[13px] font-semibold text-white/90">{title}</h2>
        {aside && <span className="text-xs text-white/45 tnum">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

function SetupNote() {
  const steps: [string, string][] = [
    ['busy', 'When you are busy'],
    ['focus', 'When you focus best'],
    ['routines', 'What repeats'],
  ]
  return (
    <section className="rounded-lg border border-white/10 px-4 py-3">
      <p className="text-[13px] text-white">Tell the scheduler about your week</p>
      <p className="mt-0.5 text-xs text-white/50">Two minutes of setup, and the plan stops guessing.</p>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {steps.map(([id, label]) => (
          <Link key={id} to={`/setup#${id}`} className="text-xs text-white/70 underline-offset-4 hover:text-white hover:underline">
            {label}
          </Link>
        ))}
      </div>
    </section>
  )
}
