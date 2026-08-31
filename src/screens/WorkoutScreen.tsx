import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { SourceBadge } from '../components/Badges'
import { db, uid } from '../db'
import { recommendProgression } from '../engines/logic'
import {
  getActivePlanVersionId,
  updateExerciseAsCustom,
  useExercises,
  usePrescriptions,
  useWorkoutDays,
} from '../hooks/useProgram'
import { dateForWeekday, dayOfWeekFromDate, friendlySourceNote, nextOccurrenceOfWeekday, todayISO } from '../lib/dates'
import {
  findOrCreateSession,
  getLastProgression,
  getLastWorkingSets,
  progressionLabel,
  summarizePreviousSets,
  type PreviousSetPerf,
} from '../lib/workoutHistory'
import type {
  Exercise,
  ExercisePrescription,
  ProgressionHistory,
  SessionQuality,
  SetLog,
  WorkoutSession,
} from '../models/types'

const QUALITY_OPTIONS: SessionQuality[] = [
  'Too easy',
  'Appropriate',
  'Hard but manageable',
  'Excessive fatigue',
]

export function WorkoutHubScreen() {
  const today = todayISO()
  const workoutDays = useWorkoutDays()
  const dayName = dayOfWeekFromDate(today)
  const wd = workoutDays.find((d) => d.day === dayName)
  const recent =
    useLiveQuery(() => db.sessions.orderBy('date').reverse().limit(8).toArray()) ?? []

  return (
    <div className="page">
      <h1>Workout</h1>
      <p className="muted small">Today&apos;s session and your weekly split.</p>

      <div className="section-label">Today</div>
      <div className="card card-strong">
        <div className="check-title">{wd?.workoutName ?? '—'}</div>
        <div className="check-sub">{friendlySourceNote(wd?.sourceNote)}</div>
        {wd && (wd.type === 'TRAINING' || wd.type === 'ACTIVE_RECOVERY') ? (
          <Link
            to={`/workout/session/${wd.id}?date=${today}`}
            className="btn btn-primary"
            style={{ marginTop: 12, display: 'inline-flex' }}
          >
            {wd.type === 'ACTIVE_RECOVERY' ? 'Log recovery' : 'Start workout'}
          </Link>
        ) : (
          <p className="small muted" style={{ marginTop: 8 }}>
            Full rest — no hard training. Keep nutrition and creatine.
          </p>
        )}
      </div>

      <Link to="/program" className="btn btn-secondary btn-block" style={{ marginTop: 12 }}>
        Edit program / exercises
      </Link>
      <Link to="/recipes" className="btn btn-secondary btn-block" style={{ marginTop: 8 }}>
        Recipes
      </Link>

      <div className="section-label">This week</div>
      {workoutDays.map((d) => {
        const date = dateForWeekday(d.day, today)
        return (
          <Link
            key={d.id}
            to={d.type === 'REST' ? '#' : `/workout/session/${d.id}?date=${date}`}
            className="list-link"
            onClick={(e) => {
              if (d.type === 'REST') e.preventDefault()
            }}
          >
            <div className="row-between">
              <div>
                <strong>
                  {d.day} · {d.workoutName}
                </strong>
                <div className="check-sub">{friendlySourceNote(d.sourceNote)}</div>
              </div>
              {d.day === dayName && <span className="chip">Today</span>}
            </div>
          </Link>
        )
      })}

      <div className="section-label">Recent sessions</div>
      {recent.length === 0 && <p className="empty">No sessions logged yet.</p>}
      {recent.map((s) => {
        const dayMeta = workoutDays.find((d) => d.id === s.workoutDayId)
        return (
          <div key={s.id} className="card">
            <div className="row-between">
              <strong>{dayMeta?.workoutName ?? 'Workout'}</strong>
              <span className="chip">{s.status}</span>
            </div>
            <div className="check-sub">{s.date}</div>
          </div>
        )
      })}
    </div>
  )
}

export function WorkoutSessionScreen() {
  const { dayId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const workoutDays = useWorkoutDays()
  const wd = workoutDays.find((d) => d.id === dayId)

  const sessionDate = useMemo(() => {
    if (params.get('date')) return params.get('date')!
    if (wd) return dateForWeekday(wd.day)
    return todayISO()
  }, [params, wd])

  const prescriptions = usePrescriptions(dayId)
  const exercises = useExercises()
  const exerciseMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  const session = useLiveQuery(async () => {
    if (!dayId) return undefined
    const rows = await db.sessions.where('date').equals(sessionDate).toArray()
    const matches = rows.filter((s) => s.workoutDayId === dayId)
    if (!matches.length) return null
    // Prefer terminal statuses so a stale IN_PROGRESS duplicate can't unlock editing
    const locked = matches.find(
      (s) =>
        s.status === 'COMPLETED' ||
        s.status === 'SKIPPED' ||
        s.status === 'MISSED',
    )
    return locked ?? matches[0]
  }, [dayId, sessionDate])
  const sessionLoading = session === undefined

  const setLogs =
    useLiveQuery(
      () =>
        session
          ? db.setLogs.where('sessionId').equals(session.id).toArray()
          : Promise.resolve([] as SetLog[]),
      [session?.id],
    ) ?? []

  const historyByExercise = useLiveQuery(async () => {
    const map: Record<
      string,
      {
        progression?: ProgressionHistory
        previous: { date: string; sets: PreviousSetPerf[] } | null
      }
    > = {}
    for (const rx of prescriptions) {
      map[rx.exerciseId] = {
        progression: await getLastProgression(rx.exerciseId, sessionDate),
        previous: await getLastWorkingSets(rx.exerciseId, sessionDate),
      }
    }
    return map
  }, [prescriptions.map((p) => p.exerciseId).join(','), sessionDate])

  const [timer, setTimer] = useState(0)
  const [timerOn, setTimerOn] = useState(false)
  const [summary, setSummary] = useState(false)
  const [missOpen, setMissOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [quality, setQuality] = useState<SessionQuality>('Appropriate')
  const [primarySkill, setPrimarySkill] = useState('')
  const [secondarySkill, setSecondarySkill] = useState('')
  const [editEx, setEditEx] = useState<Exercise | null>(null)

  const isLocked =
    sessionLoading ||
    session?.status === 'COMPLETED' ||
    session?.status === 'SKIPPED' ||
    session?.status === 'MISSED'

  useEffect(() => {
    if (!timerOn) return
    const id = window.setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          setTimerOn(false)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [timerOn])

  useEffect(() => {
    if (session?.notes) setNotes(session.notes)
    if (session?.sessionQuality) setQuality(session.sessionQuality)
    if (session?.primarySkill) setPrimarySkill(session.primarySkill)
    if (session?.secondarySkill) setSecondarySkill(session.secondarySkill)
  }, [session?.id])

  if (!wd) {
    return (
      <div className="page">
        <p>Workout not found.</p>
        <Link to="/workout">Back</Link>
      </div>
    )
  }

  if (sessionLoading) {
    return (
      <div className="page">
        <p className="muted">Loading session…</p>
      </div>
    )
  }

  async function ensureSession(): Promise<WorkoutSession> {
    const planVersionId = await getActivePlanVersionId()
    return findOrCreateSession({
      existing: session,
      date: sessionDate,
      workoutDayId: wd!.id,
      planVersionId,
      create: () => ({
        id: uid('sess'),
        date: sessionDate,
        workoutDayId: wd!.id,
        workoutPlanVersionId: planVersionId,
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
      }),
    })
  }

  async function upsertSet(
    rx: ExercisePrescription,
    setNumber: number,
    kind: 'WORKING' | 'WARMUP',
    patch: Partial<SetLog>,
  ) {
    if (isLocked || sessionLoading) return
    const s = await ensureSession()
    if (s.status === 'COMPLETED' || s.status === 'SKIPPED' || s.status === 'MISSED') {
      return
    }
    const setId = `set:${s.id}:${rx.exerciseId}:${kind}:${setNumber}`
    const existing =
      setLogs.find(
        (l) =>
          l.exerciseId === rx.exerciseId &&
          l.setNumber === setNumber &&
          l.kind === kind,
      ) ?? (await db.setLogs.get(setId))
    const row: SetLog = {
      id: existing?.id ?? setId,
      sessionId: s.id,
      exerciseId: rx.exerciseId,
      setNumber,
      kind,
      load: existing?.load,
      reps: existing?.reps,
      rir: existing?.rir,
      completed: existing?.completed ?? false,
      variation: existing?.variation,
      ...patch,
    }
    await db.setLogs.put(row)
  }

  async function completeWorkout() {
    const s = await ensureSession()
    if (s.status === 'COMPLETED') {
      setSummary(true)
      return
    }
    if (s.status === 'SKIPPED' || s.status === 'MISSED') return

    const freshAll = await db.setLogs.where('sessionId').equals(s.id).toArray()

    await db.sessions.put({
      ...s,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      notes: notes || s.notes,
      sessionQuality: quality,
      primarySkill: primarySkill || undefined,
      secondarySkill: secondarySkill || undefined,
    })

    for (const rx of prescriptions) {
      const logs = freshAll.filter(
        (l) => l.exerciseId === rx.exerciseId && l.kind === 'WORKING',
      )
      const advice = recommendProgression(rx, logs)
      // One progression row per exercise per session date
      const existingProg = await db.progression
        .where('exerciseId')
        .equals(rx.exerciseId)
        .filter((p) => p.date === sessionDate)
        .first()
      await db.progression.put({
        id: existingProg?.id ?? uid('prog'),
        exerciseId: rx.exerciseId,
        date: sessionDate,
        recommendation: advice.action,
        reason: advice.reason,
        previousLoad: logs.find((l) => l.load != null)?.load,
      })
    }

    setSummary(true)
  }

  async function handleMiss(choice: 'SKIPPED' | 'MISSED' | 'RESCHEDULE') {
    if (isLocked) return
    const s = await ensureSession()
    if (s.status === 'COMPLETED') return
    if (choice === 'RESCHEDULE') {
      await db.sessions.put({
        ...s,
        status: 'MISSED',
        notes: 'Marked for reschedule when recovered — do not stack hard sessions.',
        completedAt: new Date().toISOString(),
      })
      setMissOpen(false)
      const training = workoutDays.filter((d) => d.type === 'TRAINING')
      const idx = training.findIndex((d) => d.id === wd!.id)
      const next = training[(idx + 1) % training.length]
      if (next && next.id !== wd!.id) {
        const nextDate = nextOccurrenceOfWeekday(next.day, sessionDate)
        navigate(`/workout/session/${next.id}?date=${nextDate}`)
        return
      }
    } else {
      await db.sessions.put({
        ...s,
        status: choice,
        notes: 'Missed — do not stack hard catch-up sessions.',
        completedAt: new Date().toISOString(),
      })
    }
    setMissOpen(false)
    navigate('/workout')
  }

  if (wd.type === 'ACTIVE_RECOVERY') {
    return (
      <RecoveryLog
        wdName={wd.workoutName}
        session={session ?? undefined}
        onSave={async (mins, note) => {
          const s = await ensureSession()
          await db.sessions.put({
            ...s,
            status: 'COMPLETED',
            notes: `${mins} min walk/mobility. ${note}`.trim(),
            completedAt: new Date().toISOString(),
          })
          navigate('/')
        }}
        onBack={() => navigate(-1)}
      />
    )
  }

  if (wd.type === 'REST') {
    return (
      <div className="page">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Full Rest</h1>
        <p className="muted">
          No hard training. Keep anabolic bowl, meals, protein, and creatine.
        </p>
      </div>
    )
  }

  if (summary || session?.status === 'COMPLETED') {
    return (
      <SessionSummary
        prescriptions={prescriptions}
        exercises={exerciseMap}
        setLogs={setLogs}
        quality={session?.sessionQuality ?? quality}
        readOnly={!summary && session?.status === 'COMPLETED'}
        onDone={() => navigate('/')}
      />
    )
  }

  const skillEx = prescriptions
    .map((rx) => exerciseMap.get(rx.exerciseId))
    .find((e) => e?.isSkill)

  return (
    <div className={`page${timerOn && !isLocked ? ' has-timer-dock' : ''}`}>
      <div className="row-between">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
        {!isLocked && (
          <button className="btn btn-ghost" onClick={() => setMissOpen(true)}>
            Missed?
          </button>
        )}
      </div>
      <h1>{wd.workoutName}</h1>
      <p className="muted small">
        {sessionDate} · {friendlySourceNote(wd.sourceNote)}
      </p>

      {isLocked && (
        <div className="card" style={{ marginBottom: 12 }}>
          <strong>Session {session?.status.toLowerCase()}</strong>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            This session is locked. Historical sets stay as logged.
          </p>
          <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => navigate('/')}>
            Back to Today
          </button>
        </div>
      )}

      {!isLocked && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'rgba(224,122,106,0.35)' }}>
          <strong className="small">Pain rule</strong>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            Stop and substitute if you feel sharp pain, worsening pain, or concerning joint pain.
            Do not push through. Seek professional advice when needed.
          </p>
        </div>
      )}

      {skillEx && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="check-title">Saturday skills</div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Primary skill</label>
            <select
              className="select"
              value={primarySkill}
              disabled={isLocked}
              onChange={(e) => setPrimarySkill(e.target.value)}
            >
              <option value="">Select…</option>
              {(skillEx.variationOptions ?? []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Secondary (optional, keep short)</label>
            <select
              className="select"
              value={secondarySkill}
              disabled={isLocked}
              onChange={(e) => setSecondarySkill(e.target.value)}
            >
              <option value="">None</option>
              {(skillEx.variationOptions ?? [])
                .filter((v) => v !== primarySkill)
                .map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {prescriptions.map((rx) => {
        const ex = exerciseMap.get(rx.exerciseId)
        if (!ex) return null
        const hist = historyByExercise?.[rx.exerciseId]
        return (
          <ExerciseCard
            key={rx.id}
            ex={ex}
            rx={rx}
            logs={setLogs.filter((l) => l.exerciseId === rx.exerciseId)}
            readOnly={isLocked}
            lastProgression={hist?.progression}
            previousSets={hist?.previous}
            onChange={(setNumber, kind, patch) => upsertSet(rx, setNumber, kind, patch)}
            onRest={() => {
              setTimer(rx.restSecondsSuggested)
              setTimerOn(true)
            }}
            onEdit={() => setEditEx(ex)}
          />
        )
      })}

      {!isLocked && (
        <>
          <div className="field" style={{ marginTop: 16 }}>
            <label>Session quality</label>
            <select
              className="select"
              value={quality}
              onChange={(e) => setQuality(e.target.value as SessionQuality)}
            >
              {QUALITY_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Session notes</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>

          <button className="btn btn-primary btn-block" onClick={completeWorkout}>
            Finish workout
          </button>
        </>
      )}

      {missOpen && !isLocked && (
        <div className="modal-backdrop" onClick={() => setMissOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Missed workout</h2>
            <p className="muted small">
              Do not automatically stack multiple hard workouts. Choose one option.
            </p>
            <div className="stack">
              <button
                className="btn btn-secondary btn-block"
                onClick={() => handleMiss('SKIPPED')}
              >
                Skip and continue the plan
              </button>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => handleMiss('MISSED')}
              >
                Mark missed — resume when recovered
              </button>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => handleMiss('RESCHEDULE')}
              >
                Reschedule → open next training day
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => setMissOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editEx && !isLocked && (
        <EditExerciseModal
          exercise={editEx}
          onClose={() => setEditEx(null)}
          onSave={async (name) => {
            await updateExerciseAsCustom(editEx.id, { name })
            setEditEx(null)
          }}
        />
      )}

      {timerOn && !isLocked && (
        <div className="timer-dock" role="status" aria-live="polite">
          <div className="timer">
            Rest {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setTimerOn(false)
              setTimer(0)
            }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

function ExerciseCard({
  ex,
  rx,
  logs,
  readOnly,
  lastProgression,
  previousSets,
  onChange,
  onRest,
  onEdit,
}: {
  ex: Exercise
  rx: ExercisePrescription
  logs: SetLog[]
  readOnly?: boolean
  lastProgression?: ProgressionHistory
  previousSets?: { date: string; sets: PreviousSetPerf[] } | null
  onChange: (
    setNumber: number,
    kind: 'WORKING' | 'WARMUP',
    patch: Partial<SetLog>,
  ) => void
  onRest: () => void
  onEdit: () => void
}) {
  const [variation, setVariation] = useState(ex.variationOptions?.[0] ?? '')
  const [showWarmup, setShowWarmup] = useState(false)
  const warmups = logs.filter((l) => l.kind === 'WARMUP')
  const prevBySet = new Map(
    (previousSets?.sets ?? []).map((s) => [s.setNumber, s]),
  )

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="check-title">{ex.name}</div>
          <div className="check-sub">
            {rx.sets} × {rx.repMin}–{rx.repMax}
            {rx.perSide ? ' / side' : ''} · RIR {rx.targetRIRMin}
            {rx.targetRIRMax !== rx.targetRIRMin ? `–${rx.targetRIRMax}` : ''}
          </div>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
          <SourceBadge status={ex.sourceStatus} />
          {!readOnly &&
            (ex.sourceStatus === 'RECONSTRUCTED' || ex.sourceStatus === 'CUSTOM') && (
              <button type="button" className="btn btn-ghost" onClick={onEdit}>
                Edit
              </button>
            )}
        </div>
      </div>

      {(lastProgression || previousSets) && (
        <div
          className="card"
          style={{
            marginTop: 8,
            padding: '8px 10px',
            background: 'var(--accent-soft)',
            borderColor: 'rgba(124,184,154,0.25)',
          }}
        >
          {lastProgression && (
            <div className="small">
              <strong>Last time:</strong> {progressionLabel(lastProgression.recommendation)}
            </div>
          )}
          {previousSets && (
            <div className="check-sub" style={{ marginTop: 2 }}>
              {previousSets.date}: {summarizePreviousSets(previousSets.sets)}
            </div>
          )}
          {lastProgression?.reason && (
            <div className="faint small" style={{ marginTop: 4 }}>
              {lastProgression.reason}
            </div>
          )}
        </div>
      )}

      {ex.notes && <p className="small muted">{ex.notes}</p>}
      {ex.allowsVariationChoice && ex.variationOptions && !ex.isSkill && (
        <select
          className="select"
          style={{ marginTop: 8 }}
          value={variation}
          disabled={readOnly}
          onChange={(e) => setVariation(e.target.value)}
        >
          {ex.variationOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      )}

      {!readOnly && (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 6 }}
          onClick={() => setShowWarmup((v) => !v)}
        >
          {showWarmup ? 'Hide warm-up sets' : 'Add warm-up sets'}
        </button>
      )}

      {showWarmup && !readOnly && (
        <>
          <div className="small faint" style={{ marginTop: 8 }}>
            Warm-ups (not counted as working sets)
          </div>
          {[1, 2].map((n) => {
            const log = warmups.find((l) => l.setNumber === n)
            return (
              <div className="set-card" key={`wu-${n}`}>
                <div className="set-card-head">
                  <span className="chip">Warm-up {n}</span>
                  <button
                    type="button"
                    className={`check-box${log?.completed ? ' done' : ''}`}
                    style={{
                      background: log?.completed ? 'var(--accent)' : undefined,
                      borderColor: log?.completed ? 'var(--accent)' : undefined,
                      color: '#0a1410',
                    }}
                    onClick={() => onChange(n, 'WARMUP', { completed: !log?.completed })}
                  >
                    {log?.completed ? '✓' : ''}
                  </button>
                </div>
                <div className="set-card-fields">
                  <label>
                    Load
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      placeholder="kg"
                      value={log?.load ?? ''}
                      onChange={(e) =>
                        onChange(n, 'WARMUP', {
                          load: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Reps
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      placeholder="reps"
                      value={log?.reps ?? ''}
                      onChange={(e) =>
                        onChange(n, 'WARMUP', {
                          reps: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    —
                    <input className="input" disabled placeholder="—" />
                  </label>
                </div>
              </div>
            )
          })}
        </>
      )}

      {Array.from({ length: rx.sets }, (_, i) => {
        const n = i + 1
        const log = logs.find((l) => l.setNumber === n && l.kind === 'WORKING')
        const prev = prevBySet.get(n)
        // Prefill from last session until a set row exists; first edit copies other prev fields
        const loadDisplay = log ? (log.load ?? '') : (prev?.load ?? '')
        const repsDisplay = log ? (log.reps ?? '') : (prev?.reps ?? '')
        const rirDisplay = log ? (log.rir ?? '') : ''
        return (
          <div
            className="set-card"
            key={n}
            style={
              log?.completed
                ? { borderColor: 'rgba(124,184,154,0.4)', background: 'rgba(124,184,154,0.06)' }
                : undefined
            }
          >
            <div className="set-card-head">
              <strong>Set {n}</strong>
              <button
                type="button"
                className={`check-box${log?.completed ? ' done' : ''}`}
                disabled={readOnly}
                style={{
                  background: log?.completed ? 'var(--accent)' : undefined,
                  borderColor: log?.completed ? 'var(--accent)' : undefined,
                  color: '#0a1410',
                  opacity: readOnly ? 0.7 : 1,
                }}
                onClick={() => {
                  if (readOnly) return
                  const completing = !log?.completed
                  const patch: Partial<SetLog> = {
                    completed: completing,
                    variation: variation || undefined,
                  }
                  if (completing) {
                    if (log?.load == null && prev?.load != null) patch.load = prev.load
                    if (log?.reps == null && prev?.reps != null) patch.reps = prev.reps
                    if (log?.rir == null && prev?.rir != null) patch.rir = prev.rir
                  }
                  onChange(n, 'WORKING', patch)
                  if (completing) onRest()
                }}
              >
                {log?.completed ? '✓' : ''}
              </button>
            </div>
            <div className="set-card-fields">
              <label>
                Load
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  placeholder={prev?.load != null ? String(prev.load) : 'kg'}
                  value={loadDisplay}
                  disabled={readOnly}
                  onChange={(e) =>
                    onChange(n, 'WORKING', {
                      load: e.target.value === '' ? undefined : Number(e.target.value),
                      variation: variation || undefined,
                      ...(log == null && prev?.reps != null ? { reps: prev.reps } : {}),
                      ...(log == null && prev?.rir != null ? { rir: prev.rir } : {}),
                    })
                  }
                />
              </label>
              <label>
                Reps
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  placeholder={prev?.reps != null ? String(prev.reps) : 'reps'}
                  value={repsDisplay}
                  disabled={readOnly}
                  onChange={(e) =>
                    onChange(n, 'WORKING', {
                      reps: e.target.value === '' ? undefined : Number(e.target.value),
                      ...(log == null && prev?.load != null ? { load: prev.load } : {}),
                      ...(log == null && prev?.rir != null ? { rir: prev.rir } : {}),
                    })
                  }
                />
              </label>
              <label>
                RIR
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  placeholder={prev?.rir != null ? String(prev.rir) : 'rir'}
                  value={rirDisplay}
                  disabled={readOnly}
                  onChange={(e) =>
                    onChange(n, 'WORKING', {
                      rir: e.target.value === '' ? undefined : Number(e.target.value),
                      ...(log == null && prev?.load != null ? { load: prev.load } : {}),
                      ...(log == null && prev?.reps != null ? { reps: prev.reps } : {}),
                    })
                  }
                />
              </label>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SessionSummary({
  prescriptions,
  exercises,
  setLogs,
  quality,
  readOnly,
  onDone,
}: {
  prescriptions: ExercisePrescription[]
  exercises: Map<string, Exercise>
  setLogs: SetLog[]
  quality: SessionQuality
  readOnly?: boolean
  onDone: () => void
}) {
  return (
    <div className="page">
      <h1>{readOnly ? 'Session log' : 'Session complete'}</h1>
      <p className="muted small">
        Quality: {quality}. Progression uses the full session — not one set. RIR required for load
        increases.
      </p>
      {prescriptions.map((rx) => {
        const ex = exercises.get(rx.exerciseId)
        const logs = setLogs.filter(
          (l) => l.exerciseId === rx.exerciseId && l.kind === 'WORKING',
        )
        const advice = recommendProgression(rx, logs)
        return (
          <div key={rx.id} className="card" style={{ marginTop: 10 }}>
            <strong>{ex?.name}</strong>
            <p className="small muted" style={{ margin: '6px 0' }}>
              {logs
                .filter((l) => l.completed)
                .map((l) => `${l.reps ?? '-'}@${l.load ?? 'BW'} (RIR ${l.rir ?? '?'})`)
                .join(' · ') || 'No sets logged'}
            </p>
            <div className="reco">
              <div className="small faint">
                {readOnly ? 'Recorded suggestion' : 'Suggestion'}
              </div>
              <div className="reco-primary">
                {advice.action === 'increase_load'
                  ? 'Increase load/difficulty next time'
                  : advice.action === 'more_reps'
                    ? 'Push for more reps'
                    : advice.action === 'review_fatigue'
                      ? 'Review fatigue / technique'
                      : 'Maintain current approach'}
              </div>
              <p className="small muted">{advice.reason}</p>
            </div>
          </div>
        )
      })}
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={onDone}>
        Done
      </button>
    </div>
  )
}

function RecoveryLog({
  wdName,
  session,
  onSave,
  onBack,
}: {
  wdName: string
  session?: WorkoutSession
  onSave: (mins: number, note: string) => void
  onBack: () => void
}) {
  const [mins, setMins] = useState('25')
  const [note, setNote] = useState('')
  return (
    <div className="page">
      <button className="btn btn-ghost" onClick={onBack}>
        ← Back
      </button>
      <h1>{wdName}</h1>
      <p className="muted small">20–30 minute walk · light mobility if useful · no hard workout.</p>
      {session?.status === 'COMPLETED' ? (
        <div className="card">Already logged for this date.</div>
      ) : (
        <>
          <div className="field">
            <label>Minutes</label>
            <input
              className="input"
              type="number"
              value={mins}
              onChange={(e) => setMins(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={() => onSave(Number(mins) || 25, note)}
          >
            Mark recovery done
          </button>
        </>
      )}
    </div>
  )
}

function EditExerciseModal({
  exercise,
  onClose,
  onSave,
}: {
  exercise: Exercise
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(exercise.name)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit exercise</h2>
        <p className="muted small">Saves as CUSTOM. History of prior logs stays intact.</p>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" onClick={() => onSave(name.trim() || exercise.name)}>
          Save
        </button>
      </div>
    </div>
  )
}
