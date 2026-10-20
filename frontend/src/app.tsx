import { useEffect, useState } from 'react'
import { Navigate as Redirect, Route, Routes, useLocation } from 'react-router'

import { AppShell } from '@/components/layout/app-shell'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { CaptureDialog } from '@/components/tasks/capture-dialog'
import { TaskSheet } from '@/components/tasks/task-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppData } from '@/hooks/use-app-data'
import { useChat } from '@/hooks/use-chat'
import { ChatPage } from '@/pages/chat'
import { OverviewPage } from '@/pages/overview'
import { SetupPage } from '@/pages/setup'
import { TasksPage } from '@/pages/tasks'

// Keys typed into a field are text, not shortcuts.
function isTyping(target: HTMLElement) {
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function App() {
  const { pathname } = useLocation()
  const [capturing, setCapturing] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatPath, setChatPath] = useState(pathname)
  const [editingId, setEditingId] = useState<number | null>(null)

  const data = useAppData({ openTask: setEditingId })
  const chat = useChat()
  const { meta, settings, tasks, schedule, events, busy, error, actions } = data

  // The chat drawer belongs to the page it was opened on: moving on closes it.
  if (chatPath !== pathname) {
    setChatPath(pathname)
    setChatOpen(false)
  }

  // The Chat page is the chat, so the drawer has nothing to add there.
  const chatAvailable = pathname !== '/chat'

  // From anywhere: `n` or `/` opens capture, `c` opens or closes the chat drawer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target as HTMLElement)) return
      if (event.key === 'n' || event.key === '/') {
        event.preventDefault()
        setCapturing(true)
      } else if (event.key === 'c' && chatAvailable) {
        event.preventDefault()
        setChatOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatAvailable])

  if (error && !settings) return <Offline message={error} onRetry={() => void data.refresh()} />
  if (!settings || !meta) return <Loading />

  const editingTask = tasks.find((task) => task.id === editingId) ?? null
  const openCapture = () => setCapturing(true)

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider defaultOpen>
        <AppShell
          chat={chat}
          chatOpen={chatOpen}
          onChatOpenChange={setChatOpen}
          chatAvailable={chatAvailable}
          flush={!chatAvailable}
          sidebar={
            <AppSidebar
              studentName={settings.student.name}
              chat={chat}
              onAddTask={openCapture}
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
            <Route index element={<OverviewPage />} />
            <Route path="calendar" element={<Redirect to="/" replace />} />
            <Route path="week" element={<Redirect to="/" replace />} />
            <Route path="tasks" element={
              <TasksPage tasks={tasks} schedule={schedule} busy={busy} actions={actions}
                         onOpenTask={setEditingId} onCapture={openCapture} />
            } />
            <Route path="chat" element={<ChatPage chat={chat} />} />
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
      <p className="animate-pulse text-sm text-sidebar-foreground/60">Reading your week…</p>
    </div>
  )
}

function Offline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-dvh place-items-center px-4">
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
