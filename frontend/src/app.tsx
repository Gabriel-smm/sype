import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Navigate as Redirect, Route, Routes, useLocation, useNavigate } from 'react-router'

import { ChatPanel } from '@/components/chat/chat-panel'
import { SplashCursor } from '@/components/effects/splash-cursor'
import { Background } from '@/components/layout/background'
import { Footer } from '@/components/layout/footer'
import { Logo, Navbar } from '@/components/layout/navbar'
import { CaptureDialog } from '@/components/tasks/capture-dialog'
import { TaskSheet } from '@/components/tasks/task-sheet'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppData } from '@/hooks/use-app-data'
import { useChat } from '@/hooks/use-chat'
import { useCursorTrail } from '@/hooks/use-cursor-trail'
import { SetupPage } from '@/pages/setup'
import { TasksPage } from '@/pages/tasks'
import { TodayPage } from '@/pages/today'
import { WeekPage } from '@/pages/week'

// Keys typed into a field are text, not shortcuts.
function isTyping(target: HTMLElement) {
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function App() {
  const location = useLocation()
  const routerNavigate = useNavigate()
  const navigate = useCallback((to: string) => { void routerNavigate(to) }, [routerNavigate])
  const [capturing, setCapturing] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const data = useAppData({ openTask: setEditingId, navigate })
  const chat = useChat()
  const cursor = useCursorTrail()
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

  if (error && !settings) return <Offline message={error} onRetry={() => void data.refresh()} />
  if (!settings || !meta) return <Loading />

  const editingTask = tasks.find((task) => task.id === editingId) ?? null
  const openCapture = () => setCapturing(true)

  return (
    <MotionConfig reducedMotion="user">
    <TooltipProvider delayDuration={300}>
      <Background />
      {cursor.active && <SplashCursor />}
      <Navbar
        pendingCount={tasks.filter((task) => task.status === 'pending').length}
        onAdd={openCapture}
        onChat={() => setChatOpen(true)}
      />

      <main className="mx-auto w-full max-w-7xl px-4 pt-28 pb-10 md:px-6 md:pt-36">
        {error && (
          <p role="alert" className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route index element={
                <TodayPage schedule={schedule} tasks={tasks} settings={settings} busy={busy}
                           onComplete={data.onComplete} onSkip={data.onSkip} onOpenTask={setEditingId}
                           onCapture={openCapture} fixes={data.fixes} />
              } />
              <Route path="week" element={
                <WeekPage schedule={schedule} settings={settings} busy={busy}
                          onRegenerate={() => void data.regenerate()}
                          onMoveSlot={(slot, start, end) => void data.moveSlot(slot, start, end)}
                          onComplete={data.onComplete} onSkip={data.onSkip} onOpenTask={setEditingId}
                          fixes={data.fixes} />
              } />
              <Route path="tasks" element={
                <TasksPage tasks={tasks} busy={busy} actions={actions} onOpenTask={setEditingId}
                           onCapture={openCapture} />
              } />
              <Route path="setup" element={
                <SetupPage settings={settings} events={events} taskTypes={meta.task_types}
                           busy={busy} actions={actions} cursor={cursor} />
              } />
              <Route path="*" element={<Redirect to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {location.pathname !== '/week' && <Footer />}

      <CaptureDialog open={capturing} onOpenChange={setCapturing} taskTypes={meta.task_types}
                     busy={busy} onCreate={actions.createTask} />

      <TaskSheet task={editingTask} taskTypes={meta.task_types} busy={busy} actions={actions}
                 onClose={() => setEditingId(null)} />

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent title="Chat" bare
                      className="max-w-[min(94vw,520px)]">
          <ChatPanel chat={chat} />
        </SheetContent>
      </Sheet>

      <Toaster />
    </TooltipProvider>
    </MotionConfig>
  )
}

function Loading() {
  return (
    <div className="grid h-dvh place-items-center">
      <Background />
      <p className="animate-pulse text-sm text-muted-foreground">Reading your week…</p>
    </div>
  )
}

function Offline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-dvh place-items-center px-6">
      <Background />
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">The scheduler is not answering</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <p className="mt-5 text-sm text-faint">
          Start the backend with <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-accent-ink">./dev.sh</code>{' '}
          from the repository root, or <code className="text-muted-foreground">uvicorn app.main:app --port 8000</code> inside{' '}
          <code className="text-muted-foreground">backend</code>.
        </p>
        <Button className="mt-6" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  )
}
