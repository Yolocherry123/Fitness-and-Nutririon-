import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SourceBadge } from '../components/Badges'
import { Modal } from '../components/Modal'
import {
  addExerciseToDay,
  archiveAndCreatePlanVersion,
  removePrescriptionFromDay,
  updateExerciseAsCustom,
  upsertPrescription,
  useExercises,
  usePrescriptions,
  useWorkoutDays,
} from '../hooks/useProgram'
import type { Exercise, ExercisePrescription } from '../models/types'

export function ProgramEditorScreen() {
  const workoutDays = useWorkoutDays()
  const trainingDays = workoutDays.filter((d) => d.type === 'TRAINING')
  const [dayId, setDayId] = useState<string>('')
  const activeDayId = dayId || trainingDays[0]?.id || ''
  const activeDay = workoutDays.find((d) => d.id === activeDayId)
  const prescriptions = usePrescriptions(activeDayId)
  const exercises = useExercises()
  const exerciseMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<{
    ex: Exercise
    rx: ExercisePrescription
  } | null>(null)
  const [msg, setMsg] = useState('')

  async function snapshot(reason: string) {
    await archiveAndCreatePlanVersion(reason)
    setMsg('Saved a plan version so history stays intact.')
  }

  return (
    <div className="page">
      <div className="row-between">
        <Link to="/workout" className="btn btn-ghost">
          ← Workout
        </Link>
        <button
          className="btn btn-secondary"
          onClick={() => snapshot('Manual snapshot before/after program edit')}
        >
          Snapshot plan
        </button>
      </div>
      <h1>Edit program</h1>
      <p className="muted small">
        Add, edit, or remove exercises. Past workout logs stay. Use Snapshot if you want a
        version checkpoint.
      </p>
      {msg && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {msg}
        </p>
      )}

      <div className="day-strip" style={{ marginTop: 12 }}>
        {trainingDays.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`day-chip${activeDayId === d.id ? ' selected' : ''}`}
            onClick={() => setDayId(d.id)}
          >
            <div className="day-abbr">{d.day.slice(0, 3)}</div>
            <div className="day-meta">{d.workoutName.split(' ')[0]}</div>
          </button>
        ))}
      </div>

      {activeDay && (
        <div className="card card-strong" style={{ marginBottom: 12 }}>
          <div className="check-title">{activeDay.workoutName}</div>
          <div className="check-sub">{activeDay.day}</div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            onClick={() => setAdding(true)}
          >
            Add exercise
          </button>
        </div>
      )}

      {prescriptions.map((rx) => {
        const ex = exerciseMap.get(rx.exerciseId)
        if (!ex) return null
        return (
          <div key={rx.id} className="card" style={{ marginTop: 10 }}>
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="check-title">{ex.name}</div>
                <div className="check-sub">
                  {rx.sets} × {rx.repMin}–{rx.repMax}
                  {rx.perSide ? ' / side' : ''} · RIR {rx.targetRIRMin}
                  {rx.targetRIRMax !== rx.targetRIRMin ? `–${rx.targetRIRMax}` : ''} · rest{' '}
                  {rx.restSecondsSuggested}s
                </div>
              </div>
              <SourceBadge status={ex.sourceStatus} />
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setEditing({ ex, rx })}
              >
                Edit
              </button>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Remove “${ex.name}” from ${activeDay?.workoutName}? Past logs stay.`,
                    )
                  ) {
                    return
                  }
                  await removePrescriptionFromDay(rx.id)
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )
      })}

      {prescriptions.length === 0 && activeDay && (
        <p className="empty">No exercises on this day yet.</p>
      )}

      {adding && activeDay && (
        <ExerciseForm
          title={`Add to ${activeDay.workoutName}`}
          onClose={() => setAdding(false)}
          onSave={async (values) => {
            const vars = values.variationOptions
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
            await addExerciseToDay({
              workoutDayId: activeDay.id,
              name: values.name,
              sets: values.sets,
              repMin: values.repMin,
              repMax: values.repMax,
              targetRIRMin: values.targetRIRMin,
              targetRIRMax: values.targetRIRMax,
              restSecondsSuggested: values.restSecondsSuggested,
              perSide: values.perSide,
              notes: values.notes || undefined,
              variationOptions: vars.length ? vars : undefined,
            })
            setAdding(false)
            setMsg(`Added “${values.name}”.`)
          }}
        />
      )}

      {editing && (
        <ExerciseForm
          title="Edit exercise"
          initial={{
            name: editing.ex.name,
            sets: editing.rx.sets,
            repMin: editing.rx.repMin,
            repMax: editing.rx.repMax,
            targetRIRMin: editing.rx.targetRIRMin,
            targetRIRMax: editing.rx.targetRIRMax,
            restSecondsSuggested: editing.rx.restSecondsSuggested,
            perSide: !!editing.rx.perSide,
            notes: editing.ex.notes ?? editing.rx.notes ?? '',
            variationOptions: (editing.ex.variationOptions ?? []).join('\n'),
          }}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const vars = values.variationOptions
              ? values.variationOptions
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : []
            await updateExerciseAsCustom(editing.ex.id, {
              name: values.name.trim(),
              notes: values.notes || undefined,
              allowsVariationChoice: vars.length > 0,
              variationOptions: vars.length ? vars : undefined,
            })
            await upsertPrescription({
              ...editing.rx,
              sets: values.sets,
              repMin: values.repMin,
              repMax: values.repMax,
              targetRIRMin: values.targetRIRMin,
              targetRIRMax: values.targetRIRMax,
              restSecondsSuggested: values.restSecondsSuggested,
              perSide: values.perSide,
              notes: values.notes || undefined,
            })
            setEditing(null)
            setMsg(`Updated “${values.name}”.`)
          }}
        />
      )}
    </div>
  )
}

type FormValues = {
  name: string
  sets: number
  repMin: number
  repMax: number
  targetRIRMin: number
  targetRIRMax: number
  restSecondsSuggested: number
  perSide: boolean
  notes: string
  variationOptions: string
}

function ExerciseForm({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string
  initial?: Partial<FormValues>
  onClose: () => void
  onSave: (v: FormValues) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [sets, setSets] = useState(initial?.sets ?? 3)
  const [repMin, setRepMin] = useState(initial?.repMin ?? 8)
  const [repMax, setRepMax] = useState(initial?.repMax ?? 12)
  const [rirMin, setRirMin] = useState(initial?.targetRIRMin ?? 1)
  const [rirMax, setRirMax] = useState(initial?.targetRIRMax ?? 2)
  const [rest, setRest] = useState(initial?.restSecondsSuggested ?? 120)
  const [perSide, setPerSide] = useState(initial?.perSide ?? false)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [variations, setVariations] = useState(initial?.variationOptions ?? '')

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              if (!name.trim()) return
              onSave({
                name,
                sets,
                repMin,
                repMax,
                targetRIRMin: rirMin,
                targetRIRMax: rirMax,
                restSecondsSuggested: rest,
                perSide,
                notes,
                variationOptions: variations,
              })
            }}
          >
            Save
          </button>
          <button className="btn btn-ghost btn-block" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
        <div className="field">
          <label>Exercise name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Sets</label>
            <input
              className="input"
              type="number"
              value={sets}
              onChange={(e) => setSets(Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Rep min</label>
            <input
              className="input"
              type="number"
              value={repMin}
              onChange={(e) => setRepMin(Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Rep max</label>
            <input
              className="input"
              type="number"
              value={repMax}
              onChange={(e) => setRepMax(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>RIR min</label>
            <input
              className="input"
              type="number"
              value={rirMin}
              onChange={(e) => setRirMin(Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>RIR max</label>
            <input
              className="input"
              type="number"
              value={rirMax}
              onChange={(e) => setRirMax(Number(e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Rest (sec)</label>
            <input
              className="input"
              type="number"
              value={rest}
              onChange={(e) => setRest(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="card row-between" style={{ marginBottom: 12 }}>
          <span>Per side / unilateral</span>
          <button
            type="button"
            className={`switch${perSide ? ' on' : ''}`}
            onClick={() => setPerSide((v) => !v)}
          />
        </div>
        <div className="field">
          <label>Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Variation options (one per line, optional)</label>
          <textarea
            className="input"
            rows={2}
            value={variations}
            onChange={(e) => setVariations(e.target.value)}
            placeholder="e.g. Incline press&#10;Feet-elevated push-ups"
          />
        </div>
    </Modal>
  )
}
