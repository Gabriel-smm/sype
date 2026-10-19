import { Plus } from 'lucide-react'

import type { Calendar, Category } from '@/types/api'
import { CalendarList } from './calendar-list'
import { CategoryList } from './category-list'
import { MiniMonth } from './mini-month'

interface CalendarSidePanelProps {
  date: Date
  calendars: Calendar[]
  categories: Category[]
  /** Opens quick-create, as `c` does. */
  onCreate: (anchor: DOMRect) => void
  onSelectDate: (day: Date) => void
  onToggleCalendar: (id: number, visible: boolean) => void
  onManageCategories: () => void
}

/** The left panel: Create, the mini month, then the calendar and category lists. */
export function CalendarSidePanel({
  date, calendars, categories, onCreate, onSelectDate, onToggleCalendar, onManageCategories,
}: CalendarSidePanelProps) {
  return (
    <div className="flex flex-col gap-4 pt-2 pb-4">
      <div className="px-3">
        <button
          type="button"
          onClick={(event) => onCreate(event.currentTarget.getBoundingClientRect())}
          className="flex h-12 items-center gap-3 rounded-2xl bg-white/10 pr-5 pl-3.5 text-sm font-medium hover:bg-white/15"
        >
          <Plus aria-hidden className="size-6 text-blue-400" strokeWidth={2.25} />
          Create
        </button>
      </div>
      <MiniMonth date={date} onSelect={onSelectDate} />
      <CalendarList calendars={calendars} onToggle={onToggleCalendar} />
      <CategoryList categories={categories} onManage={onManageCategories} />
    </div>
  )
}
