import { History, Moon, Repeat, SlidersHorizontal, Target, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router'

import { WeekStrip } from '@/components/schedule/week-strip'
import { ActivityLog } from '@/components/setup/activity-log'
import { BlockList } from '@/components/setup/block-list'
import { RecurringTasks } from '@/components/setup/recurring-tasks'
import { WeightsEditor } from '@/components/setup/weights-editor'
import { Card, CardHeader } from '@/components/ui/card'
import type { ActivityEvent, Settings } from '@/types/api'
import type { Actions } from '@/types/app'

// The first three are what a new student has to fill in; they come first.
const SECTIONS: [string, string][] = [
  ['busy', 'Busy'],
  ['focus', 'Focus'],
  ['routines', 'Routines'],
  ['ranking', 'Ranking'],
  ['activity', 'Activity'],
]

interface SetupPageProps {
  settings: Settings
  events: ActivityEvent[]
  taskTypes: string[]
  busy: boolean
  actions: Actions
}

export function SetupPage({ settings, events, taskTypes, busy, actions }: SetupPageProps) {
  const { hash } = useLocation()
  const scroller = useRef<HTMLDivElement>(null)

  // Deep links (/setup#focus) land on their section once it has rendered.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <Card className="h-full min-h-0 w-full pb-0">
      <CardHeader title="Setup" description="Everything the scheduler knows about your week. Start with busy and focus hours." />

      <nav aria-label="Sections on this page" className="-mt-2 flex flex-shrink-0 gap-1 overflow-x-auto px-4">
        {SECTIONS.map(([key, label]) => (
          <a key={key} href={`#${key}`}
             className="rounded-md border border-sidebar-border px-2.5 py-1 text-xs whitespace-nowrap text-sidebar-foreground/60
                        transition-colors hover:border-white/20 hover:bg-white/10 hover:text-sidebar-foreground">
            {label}
          </a>
        ))}
      </nav>

      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <Section id="busy" icon={Moon} title="When you are busy"
                 blurb="Sleep, meals and classes. The scheduler never puts work inside these.">
          <WeekStrip blocks={settings.fixed_blocks} tint="#9ea6b8" addLabel="a busy stretch" busy={busy}
                     onAdd={actions.addFixedBlock} onDelete={(id) => void actions.deleteFixedBlock(id)} />
          <BlockList blocks={settings.fixed_blocks} onDelete={(id) => void actions.deleteFixedBlock(id)} withKind />
        </Section>

        <Section id="focus" icon={Target} title="When you focus best"
                 blurb="Work that needs concentration, like essay drafting and exam study, only goes inside these hours.">
          <WeekStrip blocks={settings.productive_hours} tint="#60a5fa" addLabel="a stretch where you focus well"
                     busy={busy} onAdd={actions.addProductiveWindow}
                     onDelete={(id) => void actions.deleteProductiveWindow(id)} />
          <BlockList blocks={settings.productive_hours} onDelete={(id) => void actions.deleteProductiveWindow(id)} />
        </Section>

        <Section id="routines" icon={Repeat} title="What repeats"
                 blurb="Gym, laundry, chores. Each active routine lands on the calendar every week it is due.">
          <RecurringTasks recurringTasks={settings.recurring_tasks} taskTypes={taskTypes} busy={busy} actions={actions} />
        </Section>

        <Section id="ranking" icon={SlidersHorizontal} title="What comes first"
                 blurb="Four things decide the order your work is scheduled in. These weights say how loudly each one speaks.">
          <WeightsEditor weights={settings.weights} busy={busy} onSave={actions.saveWeights} />
        </Section>

        <Section id="activity" icon={History} title="What you have done"
                 blurb="Every reschedule, skip and completion is recorded, as raw material for personalising this later.">
          <ActivityLog events={events} />
        </Section>
      </div>
    </Card>
  )
}

function Section({ id, icon: Icon, title, blurb, children }: {
  id: string
  icon: LucideIcon
  title: string
  blurb: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-lg border border-sidebar-border bg-sidebar/60 p-4">
      <div className="mb-4 flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-blue-400" />
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-0.5 max-w-[62ch] text-xs text-white/60">{blurb}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
