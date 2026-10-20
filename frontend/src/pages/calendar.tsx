import { useRef } from 'react'

import { CalendarSidePanel } from '@/components/calendar/calendar-side-panel'
import { CalendarToolbar } from '@/components/calendar/calendar-toolbar'
import { CategoryManagerDialog } from '@/components/calendar/category-manager-dialog'
import { DeleteSeriesDialog } from '@/components/calendar/delete-series-dialog'
import { EventDialog } from '@/components/calendar/event-dialog'
import { EventPopover } from '@/components/calendar/event-popover'
import { MonthView } from '@/components/calendar/month-view'
import { QuickCreatePopover } from '@/components/calendar/quick-create-popover'
import { ScheduleView } from '@/components/calendar/schedule-view'
import { SearchResults } from '@/components/calendar/search-results'
import { TimeGrid } from '@/components/calendar/time-grid'
import { SlotSheet } from '@/components/schedule/slot-sheet'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useCalendarPage } from '@/hooks/use-calendar-page'
import { step, titleFor } from '@/lib/calendar-view'
import type { Schedule, ScheduleSlot, Settings } from '@/types/api'
import type { Actions, SlotAction } from '@/types/app'

interface CalendarPageProps {
  schedule: Schedule
  settings: Settings
  busy: boolean
  actions: Actions
  onRegenerate: () => void
  onMoveSlot: (slot: ScheduleSlot, start: Date, end: Date) => void
  onComplete: SlotAction
  onSkip: SlotAction
  onOpenTask: (taskId: number) => void
}

/** Sype's Google-Calendar-style page: toolbar, side panel, the current view and its overlays. */
export function CalendarPage({
  schedule, settings, busy, actions, onRegenerate, onMoveSlot, onComplete, onSkip, onOpenTask,
}: CalendarPageProps) {
  const toolbar = useRef<HTMLDivElement>(null)
  const main = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const page = useCalendarPage({ schedule, createTask: actions.createTask, refs: { toolbar, main, searchInput } })
  const { view, date, range, calendar, on, panel } = page

  const completeSlot = (slot: ScheduleSlot) => {
    const id = slot.subtask_id ?? slot.task_id
    if (id != null) onComplete(id, slot.subtask_id != null).catch(() => {}) // The app banner shows failures.
  }
  const openDay = (day: Date) => page.navigate('day', day)
  const selectDate = (day: Date) => {
    page.navigate(view, day)
    panel.setSheetOpen(false)
  }

  const sidePanel = (
    <CalendarSidePanel
      date={date}
      calendars={calendar.calendars}
      categories={calendar.categories}
      onCreate={(button) => {
        panel.setSheetOpen(false)
        on.createHere(button.getBoundingClientRect(), button)
      }}
      onSelectDate={selectDate}
      onToggleCalendar={(id, visible) => void calendar.setCalendarVisible(id, visible)}
      onManageCategories={() => on.setCategoriesOpen(true)}
    />
  )

  let body
  if (page.search.current) {
    body = <SearchResults {...page.search.current} onSelect={on.openResult} />
  } else if (view === 'month') {
    body = (
      <MonthView date={date} occurrences={calendar.occurrences} slots={schedule.slots} selected={page.selected}
                 onSelectEvent={on.selectEvent} onSelectSlot={on.selectSlot}
                 onCreateAllDay={on.createAllDay} onOpenDay={openDay} />
    )
  } else if (view === 'schedule') {
    body = (
      <ScheduleView start={range.start} days={range.days.length} occurrences={calendar.occurrences}
                    slots={schedule.slots} onSelectEvent={on.selectEvent} onSelectSlot={on.selectSlot}
                    onCreate={(button) => on.createHere(button.getBoundingClientRect(), button)} />
    )
  } else {
    const draft = page.quick?.anchor && !page.quick.draft.allDay ? page.quick.draft : null
    body = (
      <TimeGrid
        key={view}
        days={range.days}
        occurrences={calendar.occurrences}
        slots={schedule.slots}
        productiveHours={settings.productive_hours}
        selected={page.selected}
        draft={draft}
        onSelectEvent={on.selectEvent}
        onSelectSlot={on.selectSlot}
        onCreateDraft={on.createDraft}
        onMoveEvent={(o, start, end) => void calendar.moveEvent(o, start, end)}
        onResizeEvent={(o, start, end) => void calendar.moveEvent(o, start, end)}
        onMoveSlot={onMoveSlot}
        onCompleteSlot={completeSlot}
        onOpenDay={openDay}
      />
    )
  }

  return (
    <Card className="h-full min-h-0 w-full gap-0 overflow-hidden py-0">
      <div ref={toolbar}>
        <CalendarToolbar
          view={view}
          title={titleFor(view, date)}
          busy={busy}
          panelOpen={panel.open}
          search={page.search}
          searchInputRef={searchInput}
          onTogglePanel={panel.toggle}
          onToday={() => page.navigate(view, new Date())}
          onStep={(direction) => page.navigate(view, step(view, date, direction))}
          onView={(next) => page.navigate(next, date)}
          onRegenerate={onRegenerate}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {!page.mobile && panel.open && (
          <aside aria-label="Calendars" className="w-64 shrink-0 overflow-y-auto">{sidePanel}</aside>
        )}
        <div ref={main} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {calendar.error && (
            <p role="alert" className="flex items-center gap-3 px-4 py-2 text-sm text-red-400">
              Could not load events: {calendar.error}
              <button type="button" onClick={calendar.refetch} className="underline underline-offset-4 hover:text-red-300">
                Try again
              </button>
            </p>
          )}
          {body}
        </div>
      </div>

      {page.mobile && (
        <Sheet open={panel.sheetOpen} onOpenChange={panel.setSheetOpen}>
          <SheetContent
            title="Calendars"
            hideHeader
            bare
            className="right-auto left-0 max-w-[min(85vw,300px)] border-r border-l-0
                       data-[state=closed]:slide-out-to-left! data-[state=open]:slide-in-from-left!"
          >
            <div className="h-full overflow-y-auto pt-2">{sidePanel}</div>
          </SheetContent>
        </Sheet>
      )}

      <EventPopover
        anchor={page.popover?.anchor ?? null}
        occurrence={page.popover?.occurrence ?? null}
        calendars={calendar.calendars}
        categories={calendar.categories}
        onClose={on.closePopover}
        onEdit={() => page.popover && on.edit(page.popover.occurrence)}
        onDelete={() => page.popover && on.remove(page.popover.occurrence)}
        onDuplicate={() => page.popover && on.duplicate(page.popover.occurrence)}
        onChangeColor={(pick) => page.popover && on.changeColor(page.popover.occurrence, pick)}
        onCloseAutoFocus={on.onCloseAutoFocus}
      />

      {page.quick && (
        <QuickCreatePopover
          anchor={page.quick.anchor}
          draft={page.quick.draft}
          calendars={calendar.calendars}
          onClose={on.closeQuick}
          onCreateEvent={calendar.createEvent}
          onCreateTask={on.createTask}
          onMoreOptions={on.moreOptions}
          onCloseAutoFocus={on.onCloseAutoFocus}
        />
      )}

      {page.dialog && (
        <EventDialog
          open={page.dialog.open}
          initial={page.dialog.initial}
          calendars={calendar.calendars}
          categories={calendar.categories}
          onOpenChange={(open) => { if (!open) on.closeDialog() }}
          onSave={on.saveDialog}
          onCloseAutoFocus={on.onDialogCloseAutoFocus}
        />
      )}

      <DeleteSeriesDialog
        occurrence={page.confirmDelete}
        onCancel={on.cancelRemove}
        onConfirm={on.confirmRemove}
        onCloseAutoFocus={on.onDialogCloseAutoFocus}
      />

      <CategoryManagerDialog
        open={page.categoriesOpen}
        onOpenChange={on.setCategoriesOpen}
        categories={calendar.categories}
        onCreate={calendar.createCategory}
        onUpdate={calendar.updateCategory}
        onDelete={calendar.deleteCategory}
      />

      <SlotSheet slot={page.slot} onClose={on.closeSlot} onComplete={onComplete}
                 onSkip={onSkip} onEditTask={onOpenTask} />
    </Card>
  )
}
