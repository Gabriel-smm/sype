import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from './api'
import CaptureBar from './components/CaptureBar'
import Drawer from './components/Drawer'
import Rail from './components/Rail'
import TaskSheet from './components/TaskSheet'
import Toast from './components/Toast'
import CalendarPage from './pages/CalendarPage'
import ChatPage from './pages/ChatPage'
import SetupPage from './pages/SetupPage'
import TasksPage from './pages/TasksPage'
import TodayPage from './pages/TodayPage'
import { placementSummary, type PlacementSummary } from './lib/agenda'
import { formatClock, toApiDateTime } from './lib/time'
import type {
  ActivityEvent, Meta, Schedule, ScheduleSlot, Settings, Task, TaskChanges,
} from './types/api'
import type { Actions, Fixes, Navigate, PageKey, ToastState } from './types/app'
import type { IconName } from './components/Rail'
import './theme.css'

const PAGES: { key: PageKey; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'today' },
  { key: 'calendar', label: 'Week', icon: 'calendar' },
  { key: 'tasks', label: 'Tasks', icon: 'tasks' },
  { key: 'setup', label: 'Setup', icon: 'parameters' },
]

// Keys typed into a field are text, not shortcuts.
function isTyping(target: HTMLElement) {
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function whereItLanded(title: string, summary: PlacementSummary): Omit<ToastState, 'action'> {
  if (summary.sessions > 0 && summary.first) {
    const first = new Date(summary.first)
    const day = first.toLocaleDateString([], { weekday: 'short' })
    const sessions = summary.sessions === 1 ? '1 session' : `${summary.sessions} sessions`
    return {
      message: `Added “${title}” — ${sessions}, first ${day} ${formatClock(first)}`
        + (summary.missed ? `; ${summary.missed} did not fit` : ''),
      tone: summary.missed ? 'warn' : undefined,
    }
  }
  if (summary.missed > 0) {
    return { message: `Added “${title}”, but it did not fit in your week`, tone: 'warn' }
  }
  return { message: `Added “${title}” — due beyond this week's plan` }
}

export default function App() {
  const [page, setPage] = useState<PageKey>('today')
  const section = useRef<string | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [schedule, setSchedule] = useState<Schedule>({ slots: [], unschedulable: [] })
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

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
      setError(`Could not reach the scheduler: ${(err as Error).message}`)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Wrap every mutation so failures surface instead of vanishing.
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setBusy(true)
    try {
      const result = await action()
      await refresh()
      setError(null)
      return result
    } catch (err) {
      setError((err as Error).message)
      throw err
    } finally {
      setBusy(false)
    }
  }, [refresh])

  // `n` or `/` from anywhere opens capture.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target as HTMLElement)) return
      if (event.key === 'n' || event.key === '/') {
        event.preventDefault()
        setCapturing(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Deep links into a page section (Setup#focus) scroll once the page renders.
  const [navigation, setNavigation] = useState(0)
  useEffect(() => {
    if (!section.current) return
    document.getElementById(section.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    section.current = null
  }, [navigation])

  const navigate: Navigate = useCallback((next, target = null) => {
    section.current = target
    setPage(next)
    setNavigation((count) => count + 1)
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])
  const closeCapture = useCallback(() => setCapturing(false), [])
  const closeChat = useCallback(() => setChatOpen(false), [])
  const closeSheet = useCallback(() => setEditingId(null), [])

  // The schedule is derived state: anything that changes what needs doing
  // rebuilds it, so the calendar is never stale.
  const updateTask = (id: number, changes: TaskChanges) => run(async () => {
    await api.updateTask(id, changes)
    await api.generateSchedule()
  })

  const actions: Actions = {
    createTask: (task) => run(async () => {
      const created = await api.createTask(task)
      const rebuilt = await api.generateSchedule()
      const { message, tone } = whereItLanded(created.title, placementSummary(rebuilt, created.id))
      setToast({
        message,
        tone,
        action: { label: 'Edit', onClick: () => setEditingId(created.id) },
      })
      return created
    }),
    updateTask,
    completeTask: (id) => run(() => api.completeTask(id)),
    skipTask: async (id) => {
      const task = tasks.find((t) => t.id === id)
      await run(() => api.skipTask(id))
      setToast({
        message: `Skipped “${task?.title ?? 'task'}”`,
        action: { label: 'Undo', onClick: () => updateTask(id, { status: 'pending' }) },
      })
    },
    deleteTask: async (id) => {
      const task = tasks.find((t) => t.id === id)
      await run(() => api.deleteTask(id))
      setToast({ message: `Deleted “${task?.title ?? 'task'}”` })
    },
    completeSubtask: (id) => run(() => api.completeSubtask(id)),
    skipSubtask: (id) => run(() => api.skipSubtask(id)),
    saveWeights: (weights) => run(() => api.saveWeights(weights)),
    addFixedBlock: (block) => run(() => api.addFixedBlock(block)),
    deleteFixedBlock: (id) => run(() => api.deleteFixedBlock(id)),
    addProductiveWindow: (window) => run(() => api.addProductiveWindow(window)),
    deleteProductiveWindow: (id) => run(() => api.deleteProductiveWindow(id)),
    createRecurringTask: (task) => run(() => api.createRecurringTask(task)),
    updateRecurringTask: (id, changes) => run(() => api.updateRecurringTask(id, changes)),
    deleteRecurringTask: (id) => run(() => api.deleteRecurringTask(id)),
  }
  // The block editors need to know whether to offer a "kind" field.
  actions.addFixedBlock.withKind = true

  const onComplete = (id: number, isSubtask: boolean) =>
    isSubtask ? actions.completeSubtask(id) : actions.completeTask(id)
  const onSkip = (id: number, isSubtask: boolean) =>
    isSubtask ? actions.skipSubtask(id) : actions.skipTask(id)

  // One-tap fixes for work that did not fit, shared by Today and Week.
  const fixes: Fixes = {
    onPushDeadline: async (taskId, days) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return
      const due = new Date(task.due_date)
      due.setDate(due.getDate() + days)
      await updateTask(taskId, { due_date: toApiDateTime(due) })
      setToast({ message: `“${task.title}” is now due ${due.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}` })
    },
    onEdit: setEditingId,
    onFocusHours: () => navigate('setup', 'focus'),
  }

  if (error && !settings) return <Offline message={error} onRetry={refresh} />
  if (!settings || !meta) return <Loading />

  const editingTask = tasks.find((task) => task.id === editingId) ?? null

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <Rail
        pages={PAGES}
        current={page}
        onNavigate={navigate}
        onAdd={() => setCapturing(true)}
        onChat={() => setChatOpen(true)}
        pendingCount={tasks.filter((task) => task.status === 'pending').length}
        online={!error}
      />

      <main className="relative min-w-0 flex-1 overflow-hidden">
        {error && (
          <p
            role="alert"
            className="absolute inset-x-0 top-0 z-50 bg-alarm/15 px-4 py-2 text-center text-[13px] text-alarm"
          >
            {error}
          </p>
        )}

        <div className="h-full overflow-hidden">
          {page === 'today' && (
            <div className="h-full overflow-y-auto">
              <TodayPage
                schedule={schedule}
                tasks={tasks}
                settings={settings}
                busy={busy}
                onComplete={onComplete}
                onSkip={onSkip}
                onOpenTask={setEditingId}
                onNavigate={navigate}
                onCapture={() => setCapturing(true)}
                fixes={fixes}
              />
            </div>
          )}

          {page === 'calendar' && (
            <CalendarPage
              schedule={schedule}
              settings={settings}
              busy={busy}
              onRegenerate={() => run(async () => setSchedule(await api.generateSchedule()))}
              onMoveSlot={(slot: ScheduleSlot, start: Date, end: Date) =>
                run(() => api.moveSlot(slot.id, toApiDateTime(start), toApiDateTime(end)))}
              onComplete={onComplete}
              onSkip={onSkip}
              onOpenTask={setEditingId}
              fixes={fixes}
            />
          )}

          {page === 'tasks' && (
            <div className="h-full overflow-y-auto">
              <TasksPage
                tasks={tasks}
                busy={busy}
                actions={actions}
                onOpenTask={setEditingId}
                onCapture={() => setCapturing(true)}
              />
            </div>
          )}

          {page === 'setup' && (
            <div className="h-full overflow-y-auto">
              <SetupPage
                settings={settings}
                events={events}
                taskTypes={meta.task_types}
                busy={busy}
                actions={actions}
              />
            </div>
          )}
        </div>
      </main>

      <CaptureBar
        open={capturing}
        onClose={closeCapture}
        taskTypes={meta.task_types}
        busy={busy}
        onCreate={actions.createTask}
      />

      <TaskSheet
        task={editingTask}
        taskTypes={meta.task_types}
        busy={busy}
        actions={actions}
        onClose={closeSheet}
      />

      <Drawer open={chatOpen} title="Chat" onClose={closeChat} width={520} bare keepMounted>
        <ChatPage />
      </Drawer>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

function Loading() {
  return (
    <div className="grid h-screen place-items-center text-[13px] text-chalk-faint">
      Reading your week…
    </div>
  )
}

function Offline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-screen place-items-center px-6">
      <div className="max-w-[46ch] text-center">
        <h1 className="font-display text-[22px]">The scheduler is not answering</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-chalk-dim">{message}</p>
        <p className="mt-4 text-[13px] text-chalk-faint">
          Start the backend with{' '}
          <code className="rounded bg-ink-800 px-1.5 py-0.5 text-lamp">
            uvicorn app.main:app --reload --port 8000
          </code>{' '}
          from the <code className="text-chalk-dim">backend</code> folder.
        </p>
        <button type="button" className="btn-lamp mt-5" onClick={onRetry}>Try again</button>
      </div>
    </div>
  )
}
