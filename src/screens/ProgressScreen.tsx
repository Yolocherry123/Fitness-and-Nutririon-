import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Link } from 'react-router-dom'
import { MILESTONES_KG } from '../models/types'
import { db } from '../db'
import { averageWeight } from '../engines/logic'
import { useWorkoutDays } from '../hooks/useProgram'
import { lastNDates, weekStartMonday, datesInWeek } from '../lib/dates'
import { IconChart } from '../components/Icons'
import { downloadBackup } from '../lib/backup'

export function ProgressScreen() {
  const profile = useLiveQuery(() => db.profile.get('user'))
  const settings = useLiveQuery(() => db.settings.get('settings'))
  const entries =
    useLiveQuery(() => db.bodyweight.orderBy('date').toArray()) ?? []
  const workoutDays = useWorkoutDays()
  const weekStart = weekStartMonday()
  const weekDates = datesInWeek(weekStart)
  const sessions =
    useLiveQuery(
      () =>
        db.sessions
          .where('date')
          .between(weekDates[0], weekDates[6], true, true)
          .toArray(),
      [weekStart],
    ) ?? []
  const [backupMsg, setBackupMsg] = useState('')

  const last7Dates = lastNDates(7)
  const last7 = entries.filter((e) => last7Dates.includes(e.date))
  const avg7 = averageWeight(last7)

  const prevWindow = lastNDates(14).slice(0, 7)
  const prev7 = entries.filter((e) => prevWindow.includes(e.date))
  const avgPrev = averageWeight(prev7)
  const trend = avg7 != null && avgPrev != null ? avg7 - avgPrev : null

  const chartData = useMemo(
    () =>
      entries.slice(-28).map((e) => ({
        date: e.date.slice(5),
        kg: e.weightKg,
      })),
    [entries],
  )

  const trainingDayIds = new Set(
    workoutDays.filter((d) => d.type === 'TRAINING').map((d) => d.id),
  )
  const planned = trainingDayIds.size
  const completed = sessions.filter(
    (s) => s.status === 'COMPLETED' && trainingDayIds.has(s.workoutDayId),
  ).length
  const recoveryDone = sessions.filter((s) => {
    const day = workoutDays.find((d) => d.id === s.workoutDayId)
    return s.status === 'COMPLETED' && day?.type === 'ACTIVE_RECOVERY'
  }).length

  const start =
    settings?.startingWeightKg ?? profile?.currentWeightKg ?? 60
  const current = profile?.currentWeightKg ?? entries.at(-1)?.weightKg ?? start
  const goal = profile?.goalWeightKg ?? 85
  const towardGoal =
    goal <= start
      ? 100
      : Math.min(100, Math.max(0, Math.round(((current - start) / (goal - start)) * 100)))
  const nextMilestone = MILESTONES_KG.find((m) => m > current)

  return (
    <div className="page">
      <h1>Progress</h1>
      <p className="muted small">Trends over days — not single weigh-ins.</p>
      <Link to="/review" className="btn btn-secondary btn-block" style={{ marginBottom: 8 }}>
        Weekly review
      </Link>

      <div className="section-label">Bodyweight</div>
      <div className="row" style={{ gap: 8 }}>
        <div className="stat" style={{ flex: 1 }}>
          <div className="stat-value">{avg7 != null ? avg7.toFixed(1) : '—'}</div>
          <div className="stat-label">7-day avg</div>
        </div>
        <div className="stat" style={{ flex: 1 }}>
          <div className="stat-value">
            {trend != null ? `${trend >= 0 ? '+' : ''}${trend.toFixed(2)}` : '—'}
          </div>
          <div className="stat-label">vs prior wk</div>
        </div>
        <div className="stat" style={{ flex: 1 }}>
          <div className="stat-value">{current.toFixed(1)}</div>
          <div className="stat-label">Latest</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, height: 220 }}>
        {chartData.length < 3 ? (
          <div className="empty-state">
            <IconChart className="empty-state-icon" />
            <strong>Chart unlocks after 3 weigh-ins</strong>
            <p className="small muted">
              {entries.length === 0
                ? 'Log morning weight on Today to start your trend.'
                : `${entries.length}/3 logged — keep similar morning conditions.`}
            </p>
            <div className="progress-bar" style={{ width: '70%', margin: '12px auto 0' }}>
              <span style={{ width: `${Math.min(100, (entries.length / 3) * 100)}%` }} />
            </div>
            <Link to="/" className="btn btn-secondary" style={{ marginTop: 14 }}>
              Log on Today
            </Link>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" stroke="#6d8077" fontSize={11} />
              <YAxis domain={['auto', 'auto']} stroke="#6d8077" fontSize={11} width={36} />
              <Tooltip
                contentStyle={{
                  background: '#1a2c24',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="kg"
                stroke="#7cb89a"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="section-label">Goals</div>
      <div className="card">
        <div className="row-between">
          <span>Toward {goal} kg</span>
          <span>{towardGoal}%</span>
        </div>
        <div className="progress-bar" style={{ marginTop: 8 }}>
          <span style={{ width: `${towardGoal}%` }} />
        </div>
        <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
          From {start} kg · Next milestone:{' '}
          {nextMilestone ?? goal} kg
          {nextMilestone
            ? ` (${(nextMilestone - current).toFixed(1)} kg to go)`
            : ' — you\'re there'}
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {MILESTONES_KG.map((m) => (
            <span
              key={m}
              className="chip"
              style={{
                borderColor: current >= m ? 'var(--accent)' : undefined,
                color: current >= m ? 'var(--accent)' : undefined,
              }}
            >
              {m} kg{current >= m ? ' ✓' : ''}
            </span>
          ))}
        </div>
      </div>

      <div className="section-label">Training this week</div>
      <div className="card">
        <div className="stat-value">
          {completed}/{planned}
        </div>
        <div className="stat-label">Hard workouts completed</div>
        {recoveryDone > 0 && (
          <p className="small muted" style={{ marginBottom: 0, marginTop: 8 }}>
            Active recovery logged separately ({recoveryDone})
          </p>
        )}
      </div>

      <div className="section-label">Targets</div>
      <div className="card">
        <div className="small">
          Calories: {profile?.calorieTargetMin}–{profile?.calorieTargetMax} kcal
        </div>
        <div className="small" style={{ marginTop: 4 }}>
          Protein: {profile?.proteinTargetMin}–{profile?.proteinTargetMax} g
        </div>
        <p className="faint small" style={{ marginBottom: 0, marginTop: 8 }}>
          Starting targets — adjustable in Settings as trends accumulate.
        </p>
      </div>

      <div className="section-label">Backup</div>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>
          Download your logs and plan as a JSON file anytime.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={async () => {
            try {
              const name = await downloadBackup()
              setBackupMsg(`Saved as ${name}`)
            } catch {
              setBackupMsg('Download failed.')
            }
          }}
        >
          Download my data
        </button>
        <Link to="/data" className="btn btn-ghost btn-block">
          Share or import →
        </Link>
        {backupMsg && (
          <p className="small" style={{ margin: 0 }}>
            {backupMsg}
          </p>
        )}
      </div>
    </div>
  )
}
