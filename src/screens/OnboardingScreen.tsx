import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import type { UserProfile } from '../models/types'

export function OnboardingScreen() {
  const navigate = useNavigate()
  const profile = useLiveQuery(() => db.profile.get('user'))
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Partial<UserProfile> | null>(null)

  const data = form ?? profile
  if (!data) {
    return <div className="page">Loading…</div>
  }

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setForm((prev) => ({ ...(prev ?? profile!), [key]: value }))
  }

  async function finish() {
    if (!profile) return
    const now = new Date().toISOString()
    const next = {
      ...profile,
      ...form,
      onboardingComplete: true,
      updatedAt: now,
    }
    await db.profile.put(next)
    const settings = await db.settings.get('settings')
    if (settings) {
      await db.settings.put({
        ...settings,
        startingWeightKg: next.currentWeightKg,
      })
    }
    navigate('/')
  }

  const steps = [
    {
      title: 'Your profile',
      body: (
        <>
          <NumField
            label="Age"
            value={data.age!}
            onChange={(v) => update('age', v)}
          />
          <NumField
            label="Height (cm)"
            value={data.heightCm!}
            step={0.1}
            onChange={(v) => update('heightCm', v)}
          />
          <NumField
            label="Current weight (kg)"
            value={data.currentWeightKg!}
            step={0.1}
            onChange={(v) => update('currentWeightKg', v)}
          />
          <NumField
            label="Long-term goal (kg)"
            value={data.goalWeightKg!}
            step={0.1}
            onChange={(v) => update('goalWeightKg', v)}
          />
        </>
      ),
    },
    {
      title: 'Training & lifestyle',
      body: (
        <>
          <div className="field">
            <label>Training preference</label>
            <input
              className="input"
              value={data.trainingPreference ?? ''}
              onChange={(e) => update('trainingPreference', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Equipment</label>
            <input
              className="input"
              value={data.equipment ?? ''}
              onChange={(e) => update('equipment', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Typical wake time</label>
            <input
              className="input"
              value={data.wakeTime ?? ''}
              onChange={(e) => update('wakeTime', e.target.value)}
            />
          </div>
        </>
      ),
    },
    {
      title: 'Nutrition setup',
      body: (
        <>
          <Toggle
            label="Milk powder as milk substitute"
            on={!!data.milkPowderSubstitute}
            onToggle={() =>
              update('milkPowderSubstitute', !data.milkPowderSubstitute)
            }
          />
          <Toggle
            label="Using creatine"
            on={!!data.usesCreatine}
            onToggle={() => update('usesCreatine', !data.usesCreatine)}
          />
          <Toggle
            label="Have whey available"
            on={!!data.usesWhey}
            onToggle={() => update('usesWhey', !data.usesWhey)}
          />
          <NumField
            label="Calorie target min"
            value={data.calorieTargetMin!}
            onChange={(v) => update('calorieTargetMin', v)}
          />
          <NumField
            label="Calorie target max"
            value={data.calorieTargetMax!}
            onChange={(v) => update('calorieTargetMax', v)}
          />
          <NumField
            label="Protein target min (g)"
            value={data.proteinTargetMin!}
            onChange={(v) => update('proteinTargetMin', v)}
          />
          <NumField
            label="Protein target max (g)"
            value={data.proteinTargetMax!}
            onChange={(v) => update('proteinTargetMax', v)}
          />
          <p className="small muted">
            These are starting targets. The app will suggest changes from bodyweight trends — never from one day alone.
          </p>
        </>
      ),
    },
  ]

  const current = steps[step]

  return (
    <div className="page" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="brand">Forge</div>
      <h1 style={{ marginTop: 12 }}>Personal fitness</h1>
      <p className="muted">
        Consistency → nutrition → progressive training → recovery.
      </p>
      <div className="progress-bar" style={{ margin: '16px 0' }}>
        <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <h2>{current.title}</h2>
      {current.body}
      <div className="row" style={{ marginTop: 20, gap: 8 }}>
        {step > 0 && (
          <button className="btn btn-secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={finish}>
            Start using the app
          </button>
        )}
      </div>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function Toggle({
  label,
  on,
  onToggle,
}: {
  label: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="row-between card" style={{ marginBottom: 10 }}>
      <span>{label}</span>
      <button
        type="button"
        className={`switch${on ? ' on' : ''}`}
        onClick={onToggle}
        aria-pressed={on}
      />
    </div>
  )
}
