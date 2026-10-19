import { Checkbox } from '@/components/ui/checkbox'
import { hexFor } from '@/lib/colors'
import type { Calendar } from '@/types/api'
import { PanelSection } from './panel-section'

interface CalendarListProps {
  calendars: Calendar[]
  onToggle: (id: number, visible: boolean) => void
}

/** "My calendars": one checkbox per calendar, tinted with its colour. Unticked calendars are hidden. */
export function CalendarList({ calendars, onToggle }: CalendarListProps) {
  return (
    <PanelSection title="My calendars">
      <ul>
        {calendars.map((calendar) => {
          const id = `calendar-${calendar.id}`
          return (
            <li key={calendar.id}>
              <label htmlFor={id} className="flex h-8 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-white/10">
                <Checkbox
                  id={id}
                  checked={calendar.visible}
                  color={hexFor(calendar.color_key)}
                  onCheckedChange={(checked) => onToggle(calendar.id, checked === true)}
                />
                <span className="min-w-0 truncate">{calendar.name}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </PanelSection>
  )
}
