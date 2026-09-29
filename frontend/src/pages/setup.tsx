import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { useLocation } from 'react-router'

import { PageHeader } from '@/components/layout/page-header'
import { WeekStrip } from '@/components/schedule/week-strip'
import { ActivityLog } from '@/components/setup/activity-log'
import { BlockList } from '@/components/setup/block-list'
import { RecurringTasks } from '@/components/setup/recurring-tasks'
import { WeightsEditor } from '@/components/setup/weights-editor'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'
import type { ActivityEvent, Settings } from '@/types/api'
import type { Actions } from '@/types/app'

// The first three are what a new student has to fill in; they come first.
const SECTIONS: [string, string][] = [
  ['busy', 'When you are busy'],
  ['focus', 'When you focus best'],
  ['routines', 'What repeats'],
  ['ranking', 'What comes first'],
  ['activity', 'What you have done'],
]

interface SetupPageProps {
  settings: Settings
  events: ActivityEvent[]
  taskTypes: string[]
  busy: boolean
  actions: Actions
}

export function SetupPage({ settings, events, taskTypes, busy, actions }: SetupPageProps) {
  const [active, setActive] = useState('busy')
  const panes = useRef<Record<string, HTMLElement | null>>({})
  const { hash } = useLocation()

  // Deep links (/setup#focus) land on their section once it has rendered.
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  // Light the index entry for whichever section is in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -65% 0px' },
    )
    Object.values(panes.current).forEach((node) => node && observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const register = (key: string) => (node: HTMLElement | null) => { panes.current[key] = node }

  return (
    <div className="space-y-10">
      <PageHeader
        title="How your week works"
        description="Everything the scheduler knows about you. Start with when you are busy and when you focus best. The rest is fine-tuning."
      />

      <div className="flex gap-10">
        <nav aria-label="Sections on this page" className="sticky top-28 hidden h-fit w-48 shrink-0 lg:block">
          <ul className="space-y-1">
            {SECTIONS.map(([key, label]) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  className={cn('block rounded-full px-4 py-2 text-sm transition-colors',
                    active === key ? 'bg-white/10 text-foreground' : 'text-faint hover:text-muted-foreground')}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <Section id="busy" title="When you are busy" ref={register('busy')}
                   blurb="Sleep, meals and classes. The scheduler never puts work inside these.">
            <WeekStrip blocks={settings.fixed_blocks} tint="#9ea6b8" addLabel="a busy stretch" busy={busy}
                       onAdd={actions.addFixedBlock} onDelete={(id) => void actions.deleteFixedBlock(id)} />
            <BlockList blocks={settings.fixed_blocks} onDelete={(id) => void actions.deleteFixedBlock(id)} withKind />
          </Section>

          <Section id="focus" title="When you focus best" ref={register('focus')}
                   blurb="Work that needs concentration, like essay drafting and exam study, is only ever placed inside these hours.">
            <WeekStrip blocks={settings.productive_hours} tint="#60a5fa" addLabel="a stretch where you focus well"
                       busy={busy} onAdd={actions.addProductiveWindow}
                       onDelete={(id) => void actions.deleteProductiveWindow(id)} />
            <BlockList blocks={settings.productive_hours} onDelete={(id) => void actions.deleteProductiveWindow(id)} />
          </Section>

          <Section id="routines" title="What repeats" ref={register('routines')}
                   blurb="The parts of the week that come back on their own: gym, laundry, chores. Each active one lands on the calendar every week it is due, right alongside your deadline work.">
            <RecurringTasks recurringTasks={settings.recurring_tasks} taskTypes={taskTypes} busy={busy} actions={actions} />
          </Section>

          <Section id="ranking" title="What comes first" ref={register('ranking')}
                   blurb="Four things decide the order your work is scheduled in. These weights say how loudly each one speaks.">
            <WeightsEditor weights={settings.weights} busy={busy} onSave={actions.saveWeights} />
          </Section>

          <Section id="activity" title="What you have done" ref={register('activity')}
                   blurb="Every reschedule, skip and completion is recorded. Nothing reads it yet. It is the raw material for personalising this later.">
            <ActivityLog events={events} />
          </Section>
        </div>
      </div>
    </div>
  )
}

interface SectionProps {
  id: string
  title: string
  blurb: string
  children: ReactNode
  ref: Ref<HTMLElement>
}

function Section({ id, title, blurb, children, ref }: SectionProps) {
  return (
    <GlassCard id={id} ref={ref} className="scroll-mt-28 p-6 md:p-8">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 mb-6 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">{blurb}</p>
      {children}
    </GlassCard>
  )
}
