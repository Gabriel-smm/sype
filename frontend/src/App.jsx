import { useCallback, useEffect, useState } from 'react'

import { api } from './api'
import Rail from './components/Rail'
import CalendarPage from './pages/CalendarPage'
import ChatPage from './pages/ChatPage'
import ParametersPage from './pages/ParametersPage'
import TasksPage from './pages/TasksPage'
import { toApiDateTime } from './lib/time'
import './theme.css'

const PAGES = [
  { key: 'calendar', label: 'Week', icon: 'calendar' },
  { key: 'tasks', label: 'Tasks', icon: 'tasks' },
  { key: 'chat', label: 'Chat', icon: 'chat' },
  { key: 'parameters', label: 'Tune', icon: 'parameters' },
]

export default function App() {
  const [page, setPage] = useState('calendar')
  const [meta, setMeta] = useState(null)
  const [settings, setSettings] = useState(null)
  const [tasks, setTasks] = useState([])
  const [schedule, setSchedule] = useState({ slots: [], unschedulable: [] })
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

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
      setError(`Could not reach the scheduler: ${err.message}`)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Wrap every mutation so failures surface instead of vanishing.
  const run = useCallback(async (action) => {
    setBusy(true)
    try {
      const result = await action()
      await refresh()
      setError(null)
      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const actions = {
    createTask: (task) => run(() => api.createTask(task)),
    completeTask: (id) => run(() => api.completeTask(id)),
    skipTask: (id) => run(() => api.skipTask(id)),
    deleteTask: (id) => run(() => api.deleteTask(id)),
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

  if (error && !settings) return <Offline message={error} onRetry={refresh} />
  if (!settings || !meta) return <Loading />

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <Rail
        pages={PAGES}
        current={page}
        onNavigate={setPage}
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
          {page === 'calendar' && (
            <CalendarPage
              schedule={schedule}
              settings={settings}
              busy={busy}
              onRegenerate={() => run(async () => setSchedule(await api.generateSchedule()))}
              onMoveSlot={(slot, start, end) =>
                run(() => api.moveSlot(slot.id, toApiDateTime(start), toApiDateTime(end)))}
              onComplete={(id, isSubtask) =>
                isSubtask ? actions.completeSubtask(id) : actions.completeTask(id)}
              onSkip={(id, isSubtask) =>
                isSubtask ? actions.skipSubtask(id) : actions.skipTask(id)}
            />
          )}

          {page === 'tasks' && (
            <div className="h-full overflow-y-auto">
              <TasksPage tasks={tasks} taskTypes={meta.task_types} busy={busy} actions={actions} />
            </div>
          )}

          {page === 'chat' && <ChatPage />}

          {page === 'parameters' && (
            <div className="h-full overflow-y-auto">
              <ParametersPage
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

function Offline({ message, onRetry }) {
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
