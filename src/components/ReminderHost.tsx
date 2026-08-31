import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { useWorkoutDays } from '../hooks/useProgram'
import { dayOfWeekFromDate, todayISO } from '../lib/dates'
import { foodActionsForDate } from '../lib/food'
import { isCreatineAction } from '../engines/logic'

type Prompt = {
  id: string
  title: string
  body: string
  to?: string
  actionLabel?: string
}

/**
 * Soft in-app prompts while the app is open — only for toggles the user enabled.
 * Not push notifications; once dismissed for the day they stay quiet.
 */
export function ReminderHost() {
  const settings = useLiveQuery(() => db.settings.get('settings'))
  const profile = useLiveQuery(() => db.profile.get('user'))
  const [date, setDate] = useState(todayISO)
  const [hour, setHour] = useState(() => new Date().getHours())
  const day = dayOfWeekFromDate(date)
  const workoutDays = useWorkoutDays()
  const wd = workoutDays.find((d) => d.day === day)
  const bwToday = useLiveQuery(() => db.bodyweight.where('date').equals(date).first(), [date])
  const session = useLiveQuery(async () => {
    if (!wd) return undefined
    const rows = await db.sessions.where('date').equals(date).toArray()
    return rows.find((s) => s.workoutDayId === wd.id)
  }, [date, wd?.id])
  const allFood = useLiveQuery(() => db.foodActions.toArray()) ?? []
  const completions =
    useLiveQuery(() => db.completions.where('date').equals(date).toArray(), [date]) ?? []

  // Refresh clock / calendar day while the tab stays open
  useEffect(() => {
    const tick = () => {
      setDate(todayISO())
      setHour(new Date().getHours())
    }
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

  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`forge-prompts-${todayISO()}`) ?? '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(`forge-prompts-${date}`) ?? '[]'))
    } catch {
      setDismissed([])
    }
  }, [date])

  const creatineDone = useMemo(() => {
    const actions = foodActionsForDate(allFood, date, { profile })
    const creatine = actions.find(isCreatineAction)
    if (!creatine) return true
    return completions.some((c) => c.foodActionId === creatine.id && c.completed)
  }, [allFood, date, profile, completions])

  const prompts: Prompt[] = []
  const r = settings?.reminders

  if (r?.bodyweight && !bwToday && hour >= 7 && hour < 12) {
    prompts.push({
      id: 'bw',
      title: 'Morning weigh-in',
      body: 'Log weight under similar conditions when you can.',
      to: '/',
      actionLabel: 'Today',
    })
  }

  if (
    r?.workout &&
    wd?.type === 'TRAINING' &&
    session?.status !== 'COMPLETED' &&
    hour >= 15 &&
    hour < 22
  ) {
    prompts.push({
      id: 'workout',
      title: wd.workoutName,
      body: 'Training is still open for today.',
      to: `/workout/session/${wd.id}?date=${date}`,
      actionLabel: 'Open',
    })
  }

  if (r?.creatine && profile?.usesCreatine && !creatineDone && hour >= 10) {
    prompts.push({
      id: 'creatine',
      title: 'Creatine',
      body: 'Normal 3–5 g dose — don’t double if you missed earlier.',
      to: '/',
      actionLabel: 'Today',
    })
  }

  if (r?.weeklyReview && day === 'Sunday' && hour >= 17) {
    prompts.push({
      id: 'review',
      title: 'Weekly review',
      body: 'A short end-of-week check keeps calorie decisions honest.',
      to: '/review',
      actionLabel: 'Review',
    })
  }

  const active = prompts.find((p) => !dismissed.includes(p.id))
  if (!active || !settings) return null

  function dismiss(id: string) {
    const next = [...dismissed, id]
    setDismissed(next)
    try {
      localStorage.setItem(`forge-prompts-${date}`, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="reminder-toast" role="status">
      <div>
        <strong>{active.title}</strong>
        <p className="small muted" style={{ margin: '2px 0 0' }}>
          {active.body}
        </p>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {active.to && (
          <Link
            to={active.to}
            className="btn btn-primary"
            style={{ padding: '8px 12px' }}
            onClick={() => dismiss(active.id)}
          >
            {active.actionLabel ?? 'Go'}
          </Link>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => dismiss(active.id)}
        >
          Later
        </button>
      </div>
    </div>
  )
}
