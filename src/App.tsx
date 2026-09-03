import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ErrorBoundary } from './components/ErrorBoundary'
import { BottomNav } from './components/BottomNav'
import { ReminderHost } from './components/ReminderHost'
import { ensureSeeded, db } from './db'
import { applyDayTheme } from './lib/dayTheme'
import { dayOfWeekFromDate, todayISO } from './lib/dates'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { TodayScreen } from './screens/TodayScreen'
import { PlanScreen } from './screens/PlanScreen'
import { WorkoutHubScreen, WorkoutSessionScreen } from './screens/WorkoutScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { RecipesScreen } from './screens/RecipesScreen'
import { ProgramEditorScreen } from './screens/ProgramEditorScreen'
import { FoodPlanEditorScreen } from './screens/FoodPlanEditorScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { DataScreen } from './screens/DataScreen'

function useDayTheme() {
  useEffect(() => {
    const tick = () => applyDayTheme(dayOfWeekFromDate(todayISO()))
    tick()
    const id = window.setInterval(tick, 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
}

function AppRoutes() {
  const profile = useLiveQuery(() => db.profile.get('user'))

  // Wait until profile row exists after seed
  if (profile === undefined) {
    return (
      <div className="app-shell no-nav page">
        <div className="brand">Forge</div>
        <p className="muted">Loading your plan…</p>
      </div>
    )
  }

  if (!profile.onboardingComplete) {
    return <OnboardingScreen />
  }

  return (
    <div className="app-shell">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/workout" element={<WorkoutHubScreen />} />
          <Route path="/workout/session/:dayId" element={<WorkoutSessionScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/review" element={<ReviewScreen />} />
          <Route path="/recipes" element={<RecipesScreen />} />
          <Route path="/program" element={<ProgramEditorScreen />} />
          <Route path="/food-plan" element={<FoodPlanEditorScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/data" element={<DataScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ReminderHost />
      </ErrorBoundary>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  useDayTheme()

  useEffect(() => {
    ensureSeeded()
      .catch((err) => {
        console.error('Failed to seed database', err)
      })
      .finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="app-shell no-nav page">
        <div className="brand">Forge</div>
        <p className="muted">Loading your plan…</p>
      </div>
    )
  }

  const base = import.meta.env.BASE_URL.replace(/\/$/, '')

  return (
    <BrowserRouter basename={base || undefined}>
      <AppRoutes />
    </BrowserRouter>
  )
}
