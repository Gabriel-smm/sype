import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate as Redirect, Route, Routes, useNavigate } from 'react-router'

import { COPILOT_INPUT_ID } from '@/components/chat/chat-panel'
import { AppShell } from '@/components/layout/app-shell'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Background } from '@/components/layout/background'
import { CaptureDialog } from '@/components/tasks/capture-dialog'
import { TaskSheet } from '@/components/tasks/task-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppData } from '@/hooks/use-app-data'
import { useChat } from '@/hooks/use-chat'
import { useIsMobile } from '@/hooks/use-mobile'
import { CalendarPage } from '@/pages/calendar'
import { SetupPage } from '@/pages/setup'
import { TasksPage } from '@/pages/tasks'
import { TodayPage } from '@/pages/today'

// Keys typed into a field are text, not shortcuts.
function isTyping(target: HTMLElement) {
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function App() {
  const routerNavigate = useNavigate()
  const navigate = useCallback((to: string) => { void routerNavigate(to) }, [routerNavigate])
  const isMobile = useIsMobile()
  const [capturing, setCapturing] = useState(false)
  const [chatSheetOpen, setChatSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const data = useAppData({ openTask: setEditingId, navigate })
  const chat = useChat()
  const { meta, settings, tasks, schedule, events, busy, error, actions } = data

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

  const pendingByType = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const task of tasks) if (task.status === 'pending') counts[task.task_type] = (counts[task.task_type] ?? 0) + 1
    return counts
  }, [tasks])

  if (error && !settings) return <Offline message={error} onRetry={() => void data.refresh()} />
  if (!settings || !meta) return <Loading />

  const editingTask = tasks.find((task) => task.id === editingId) ?? null
  const openCapture = () => setCapturing(true)
  // The Co-Pilot is always on screen on desktop; the nav item just puts the cursor in it.
  const openCopilot = () => {
    if (isMobile) setChatSheetOpen(true)
    else document.getElementById(COPILOT_INPUT_ID)?.focus()
  }

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider defaultOpen={false}>
        <Background />
        <AppShell
          chat={chat}
          chatSheetOpen={chatSheetOpen}
          onChatSheetChange={setChatSheetOpen}
          sidebar={
            <AppSidebar
              studentName={settings.student.name}
              taskTypes={meta.task_types}
              pendingByType={pendingByType}
              onAddTask={openCapture}
              onCopilot={openCopilot}
              onRebuild={() => void data.regenerate()}
            />
          }
          banner={error && (
            <p role="alert" className="mx-2 mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
        >
          <Routes>
            <Route index element={
              <TodayPage schedule={schedule} tasks={tasks} settings={settings} busy={busy}
                         onComplete={data.onComplete} onSkip={data.onSkip} onOpenTask={setEditingId}
                         onCapture={openCapture} fixes={data.fixes} />
            } />
            <Route path="calendar" element={
              <CalendarPage schedule={schedule} settings={settings} busy={busy}
                            onRegenerate={() => void data.regenerate()}
                            onMoveSlot={(slot, start, end) => void data.moveSlot(slot, start, end)}
                            onComplete={data.onComplete} onSkip={data.onSkip} onOpenTask={setEditingId}
                            fixes={data.fixes} />
            } />
            <Route path="week" element={<Redirect to="/calendar" replace />} />
            <Route path="tasks" element={
              <TasksPage tasks={tasks} schedule={schedule} busy={busy} actions={actions}
                         onOpenTask={setEditingId} onCapture={openCapture} />
            } />
            <Route path="setup" element={
              <SetupPage settings={settings} events={events} taskTypes={meta.task_types} busy={busy} actions={actions} />
            } />
            <Route path="*" element={<Redirect to="/" replace />} />
          </Routes>
        </AppShell>
      </SidebarProvider>

      <CaptureDialog open={capturing} onOpenChange={setCapturing} taskTypes={meta.task_types}
                     busy={busy} onCreate={actions.createTask} />

      <TaskSheet task={editingTask} taskTypes={meta.task_types} busy={busy} actions={actions}
                 onClose={() => setEditingId(null)} />

      <Toaster />
    </TooltipProvider>
  )
}

function Loading() {
  return (
    <div className="grid h-dvh place-items-center">
      <Background />
      <p className="animate-pulse text-sm text-sidebar-foreground/60">Reading your week…</p>
    </div>
  )
}

function Offline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-dvh place-items-center px-4">
      <Background />
      <Card className="max-w-md px-6 text-center">
        <p className="text-xl font-semibold">Sype<span className="text-blue-400">.</span></p>
        <div>
          <h1 className="font-semibold">The scheduler is not answering</h1>
          <p className="mt-2 text-sm text-sidebar-foreground/60">{message}</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Start both servers with <code className="rounded bg-white/10 px-1.5 py-0.5 text-blue-400">./dev.sh</code> from
          the repository root.
        </p>
        <Button className="mx-auto" onClick={onRetry}>Try again</Button>
      </Card>
    </div>
  )
}
