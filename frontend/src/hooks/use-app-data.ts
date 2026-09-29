import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { placementSummary, type PlacementSummary } from '@/lib/agenda'
import { api } from '@/lib/api'
import { formatClock, toApiDateTime } from '@/lib/time'
import { errorMessage } from '@/lib/utils'
import type {
  ActivityEvent, Meta, Schedule, ScheduleSlot, Settings, Task, TaskChanges,
} from '@/types/api'
import type { Actions, Fixes, Navigate, SlotAction } from '@/types/app'

function announcePlacement(title: string, summary: PlacementSummary, onEdit: () => void) {
  const action = { label: 'Edit', onClick: onEdit }
  if (summary.sessions > 0 && summary.first) {
    const first = new Date(summary.first)
    const day = first.toLocaleDateString([], { weekday: 'short' })
    const sessions = summary.sessions === 1 ? '1 session' : `${summary.sessions} sessions`
    const description = `${sessions}, first ${day} ${formatClock(first)}`
      + (summary.missed ? `. ${summary.missed} did not fit.` : '')
    const show = summary.missed ? toast.warning : toast.success
    show(`Added “${title}”`, { description, action })
  } else if (summary.missed > 0) {
    toast.warning(`Added “${title}”`, { description: 'It did not fit in your week.', action })
  } else {
    toast.success(`Added “${title}”`, { description: 'Due beyond this week’s plan.', action })
  }
}

interface Options {
  openTask: (id: number) => void
  navigate: Navigate
}

/**
 * Everything the pages read from the backend, and every change they can make.
 * Each mutation reloads the lot, so no page ever shows stale state.
 */
export function useAppData({ openTask, navigate }: Options) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [schedule, setSchedule] = useState<Schedule>({ slots: [], unschedulable: [] })
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [metaData, settingsData, taskData, scheduleData, eventData] = await Promise.all([
        api.meta(), api.settings(), api.tasks(), api.schedule(), api.events(),
      ])
      setMeta(metaData)
      setSettings(settingsData)
      setTasks(taskData)
      setSchedule(scheduleData)
      setEvents(eventData)
      setError(null)
    } catch (err) {
      setError(`Could not reach the scheduler: ${errorMessage(err)}`)
    }
  }, [])

  useEffect(() => {
    // Loading on mount is the one external sync this app needs.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  // Wrap every mutation so failures surface instead of vanishing.
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setBusy(true)
    try {
      const result = await action()
      await refresh()
      setError(null)
      return result
    } catch (err) {
      setError(errorMessage(err))
      throw err
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const titleOf = useCallback(
    (id: number) => tasks.find((task) => task.id === id)?.title ?? 'task',
    [tasks],
  )

  const actions = useMemo<Actions>(() => {
    // The schedule is derived state: anything that changes what needs doing
    // rebuilds it, so the calendar is never stale.
    const updateTask = (id: number, changes: TaskChanges) => run(async () => {
      await api.updateTask(id, changes)
      await api.generateSchedule()
    })

    const addFixedBlock = Object.assign(
      (block: Parameters<typeof api.addFixedBlock>[0]) => run(() => api.addFixedBlock(block)),
      // The block editors need to know whether to offer a "kind" field.
      { withKind: true },
    )

    return {
      createTask: (task) => run(async () => {
        const created = await api.createTask(task)
        const rebuilt = await api.generateSchedule()
        announcePlacement(created.title, placementSummary(rebuilt, created.id), () => openTask(created.id))
        return created
      }),
      updateTask,
      completeTask: (id) => run(() => api.completeTask(id)),
      skipTask: async (id) => {
        const title = titleOf(id)
        await run(() => api.skipTask(id))
        toast(`Skipped “${title}”`, {
          action: { label: 'Undo', onClick: () => void updateTask(id, { status: 'pending' }) },
        })
      },
      deleteTask: async (id) => {
        const title = titleOf(id)
        await run(() => api.deleteTask(id))
        toast(`Deleted “${title}”`)
      },
      completeSubtask: (id) => run(() => api.completeSubtask(id)),
      skipSubtask: (id) => run(() => api.skipSubtask(id)),
      saveWeights: (weights) => run(() => api.saveWeights(weights)),
      addFixedBlock,
      deleteFixedBlock: (id) => run(() => api.deleteFixedBlock(id)),
      addProductiveWindow: (window) => run(() => api.addProductiveWindow(window)),
      deleteProductiveWindow: (id) => run(() => api.deleteProductiveWindow(id)),
      createRecurringTask: (task) => run(() => api.createRecurringTask(task)),
      updateRecurringTask: (id, changes) => run(() => api.updateRecurringTask(id, changes)),
      deleteRecurringTask: (id) => run(() => api.deleteRecurringTask(id)),
    }
  }, [run, titleOf, openTask])

  const onComplete: SlotAction = (id, isSubtask) =>
    isSubtask ? actions.completeSubtask(id) : actions.completeTask(id)
  const onSkip: SlotAction = (id, isSubtask) =>
    isSubtask ? actions.skipSubtask(id) : actions.skipTask(id)

  const fixes: Fixes = {
    onPushDeadline: async (taskId, days) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      const due = new Date(task.due_date)
      due.setDate(due.getDate() + days)
      await actions.updateTask(taskId, { due_date: toApiDateTime(due) })
      toast(`“${task.title}” is now due ${due.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}`)
    },
    onEdit: openTask,
    onFocusHours: () => navigate('/setup#focus'),
  }

  const regenerate = () => run(async () => setSchedule(await api.generateSchedule()))
  const moveSlot = (slot: ScheduleSlot, start: Date, end: Date) =>
    run(() => api.moveSlot(slot.id, toApiDateTime(start), toApiDateTime(end)))

  return {
    meta, settings, tasks, schedule, events, busy, error,
    refresh, actions, onComplete, onSkip, fixes, regenerate, moveSlot,
  }
}

export type AppData = ReturnType<typeof useAppData>
