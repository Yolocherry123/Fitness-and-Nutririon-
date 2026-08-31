import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BottomNav } from './components/BottomNav'
import { ReminderHost } from './components/ReminderHost'
import { ensureSeeded, db } from './db'
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
      <BottomNav />
      <ReminderHost />
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureSeeded().then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="app-shell no-nav page">
        <div className="brand">Forge</div>
        <p className="muted">Loading your plan…</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
