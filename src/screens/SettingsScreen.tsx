import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { creatineMissMessage } from '../engines/logic'
import { archiveAndCreatePlanVersion, useActivePlanVersion } from '../hooks/useProgram'
import { downloadBackup, shareOrDownloadBackup } from '../lib/backup'

export function SettingsScreen() {
  const profile = useLiveQuery(() => db.profile.get('user'))
  const settings = useLiveQuery(() => db.settings.get('settings'))
  const activeVersion = useActivePlanVersion()
  const versions =
    useLiveQuery(async () => {
      const rows = await db.planVersions.toArray()
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }) ?? []
  const [planMsg, setPlanMsg] = useState('')
  const [notifMsg, setNotifMsg] = useState('')
  const [backupMsg, setBackupMsg] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)

  if (!profile) return <div className="page">Loading…</div>

  async function patch(partial: Partial<typeof profile>) {
    const cur = await db.profile.get('user')
    if (!cur) return
    await db.profile.put({
      ...cur,
      ...partial,
      updatedAt: new Date().toISOString(),
    })
  }

  async function toggleReminder(
    key: keyof NonNullable<typeof settings>['reminders'],
  ) {
    if (!settings) return
    const next = { ...settings.reminders, [key]: !settings.reminders[key] }
    await db.settings.put({ ...settings, reminders: next })
  }

  async function requestNotifications() {
    if (!('Notification' in window)) {
      setNotifMsg('Notifications are not supported in this browser.')
      return
    }
    const perm = await Notification.requestPermission()
    setNotifMsg(
      perm === 'granted'
        ? 'Permission granted. Enable the reminders you want below — the app can show local prompts when open.'
        : 'Permission denied. Reminders stay off.',
    )
  }

  async function archivePlan() {
    const reason = window.prompt(
      'Reason for archiving and starting a new plan version?',
      'Program update',
    )
    if (!reason) return
    const id = await archiveAndCreatePlanVersion(reason)
    setPlanMsg(`Archived previous version. Active plan version: ${id}`)
  }

  return (
    <div className="page">
      <Link to="/" className="btn btn-ghost">
        ← Today
      </Link>
      <h1>Settings</h1>

      <div className="section-label">Profile</div>
      <div className="card stack">
        <Field label="Age" value={profile.age} onSave={(v) => {
          const n = Number(v)
          if (Number.isFinite(n) && n > 0) patch({ age: n })
        }} />
        <Field
          label="Height (cm)"
          value={profile.heightCm}
          onSave={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) patch({ heightCm: n })
          }}
        />
        <Field
          label="Current weight (kg)"
          value={profile.currentWeightKg}
          onSave={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) patch({ currentWeightKg: n })
          }}
        />
        <Field
          label="Goal weight (kg)"
          value={profile.goalWeightKg}
          onSave={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) patch({ goalWeightKg: n })
          }}
        />
        <Field
          label="Starting weight for progress bar (kg)"
          value={settings?.startingWeightKg ?? profile.currentWeightKg}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n <= 0) return
            await db.settings.put({ ...settings, startingWeightKg: n })
          }}
        />
      </div>

      <div className="section-label">Targets (editable)</div>
      <div className="card stack">
        <Field
          label="Calorie min"
          value={profile.calorieTargetMin}
          onSave={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) patch({ calorieTargetMin: n })
          }}
        />
        <Field
          label="Calorie max"
          value={profile.calorieTargetMax}
          onSave={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) patch({ calorieTargetMax: n })
          }}
        />
        <Field
          label="Protein min (g)"
          value={profile.proteinTargetMin}
          onSave={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) patch({ proteinTargetMin: n })
          }}
        />
        <Field
          label="Protein max (g)"
          value={profile.proteinTargetMax}
          onSave={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) patch({ proteinTargetMax: n })
          }}
        />
        <Field
          label="Carb min (g)"
          value={profile.carbTargetMin ?? 320}
          onSave={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) patch({ carbTargetMin: n })
          }}
        />
        <Field
          label="Carb max (g)"
          value={profile.carbTargetMax ?? 400}
          onSave={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) patch({ carbTargetMax: n })
          }}
        />
      </div>

      <div className="section-label">Product labels (protein tools)</div>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>
          Used for estimated shake math. Edit to match your tub / milk powder label.
        </p>
        <Field
          label="Whey protein per serving (g)"
          value={settings?.wheyProteinPerServingG ?? 24}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n <= 0) return
            await db.settings.put({ ...settings, wheyProteinPerServingG: n })
          }}
        />
        <Field
          label="Whey calories per serving"
          value={settings?.wheyCaloriesPerServing ?? 120}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0) return
            await db.settings.put({ ...settings, wheyCaloriesPerServing: n })
          }}
        />
        <Field
          label="Milk glass protein (g)"
          value={settings?.milkProteinPerGlassG ?? 8}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0) return
            await db.settings.put({ ...settings, milkProteinPerGlassG: n })
          }}
        />
        <Field
          label="Milk-powder drink protein / serving (g)"
          value={settings?.milkPowderProteinPerServingG ?? 8}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0) return
            await db.settings.put({ ...settings, milkPowderProteinPerServingG: n })
          }}
        />
      </div>

      <div className="section-label">Sattu product label</div>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>
          Approximate until you enter your package values. Used for sattu drink logging.
        </p>
        <Field
          label="Brand / name"
          value={settings?.sattuBrandName ?? ''}
          onSave={async (v) => {
            if (!settings) return
            await db.settings.put({
              ...settings,
              sattuBrandName: v || undefined,
              sattuNutritionSource: 'PRODUCT_LABEL',
            })
          }}
        />
        <Field
          label="Serving size (g)"
          value={settings?.sattuServingSizeG ?? 40}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n <= 0) return
            await db.settings.put({
              ...settings,
              sattuServingSizeG: n,
              sattuNutritionSource: 'PRODUCT_LABEL',
            })
          }}
        />
        <Field
          label="Calories per serving"
          value={settings?.sattuCaloriesPerServing ?? 150}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0) return
            await db.settings.put({
              ...settings,
              sattuCaloriesPerServing: n,
              sattuNutritionSource: 'PRODUCT_LABEL',
            })
          }}
        />
        <Field
          label="Protein per serving (g)"
          value={settings?.sattuProteinPerServingG ?? 12}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0) return
            await db.settings.put({
              ...settings,
              sattuProteinPerServingG: n,
              sattuNutritionSource: 'PRODUCT_LABEL',
            })
          }}
        />
        <Field
          label="Carbs per serving (g)"
          value={settings?.sattuCarbsPerServingG ?? 22}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0) return
            await db.settings.put({
              ...settings,
              sattuCarbsPerServingG: n,
              sattuNutritionSource: 'PRODUCT_LABEL',
            })
          }}
        />
        <Field
          label="Fat per serving (g)"
          value={settings?.sattuFatPerServingG ?? 3}
          onSave={async (v) => {
            if (!settings) return
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0) return
            await db.settings.put({
              ...settings,
              sattuFatPerServingG: n,
              sattuNutritionSource: 'PRODUCT_LABEL',
            })
          }}
        />
      </div>

      <div className="section-label">Modes & supplements</div>
      <ToggleRow
        label="Digestion Mode"
        sub="Hides stacked fiber optionals"
        on={!!profile.digestionMode}
        onToggle={() => patch({ digestionMode: !profile.digestionMode })}
      />
      <ToggleRow
        label="Milk powder substitute"
        on={!!profile.milkPowderSubstitute}
        onToggle={() =>
          patch({ milkPowderSubstitute: !profile.milkPowderSubstitute })
        }
      />
      <ToggleRow
        label="Using creatine"
        sub="Hides creatine from Today when off"
        on={!!profile.usesCreatine}
        onToggle={() => patch({ usesCreatine: !profile.usesCreatine })}
      />
      <ToggleRow
        label="Have whey available"
        sub="Hides whey optional when off"
        on={!!profile.usesWhey}
        onToggle={() => patch({ usesWhey: !profile.usesWhey })}
      />

      <div className="section-label">In-app reminders</div>
      <div className="card" style={{ marginBottom: 10 }}>
        <p className="small muted" style={{ margin: 0 }}>
          Soft prompts while Forge is open — not phone push notifications. Each prompt
          can be dismissed for the rest of today.
        </p>
      </div>
      {settings &&
        (
          [
            ['bodyweight', 'Morning weigh-in', 'If no weight logged by midday'],
            ['workout', 'Workout', 'Afternoon/evening if training not done'],
            ['creatine', 'Creatine', 'If not checked off yet'],
            ['weeklyReview', 'Weekly review', 'Sunday evening'],
            ['mealPrep', 'Meal prep', 'Reserved — not active yet'],
          ] as const
        ).map(([key, label, sub]) => (
          <div key={key} className="card row-between" style={{ marginBottom: 8 }}>
            <div>
              <div>{label}</div>
              <div className="small muted">{sub}</div>
            </div>
            <button
              type="button"
              className={`switch${settings.reminders[key] ? ' on' : ''}`}
              disabled={key === 'mealPrep'}
              onClick={() => {
                if (key === 'mealPrep') return
                toggleReminder(key)
              }}
              aria-label={label}
            />
          </div>
        ))}
      {'Notification' in window && (
        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 4 }}
          onClick={requestNotifications}
        >
          Optional: allow browser notification permission
        </button>
      )}
      {notifMsg && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {notifMsg}
        </p>
      )}

      <div className="section-label">Missed creatine note</div>
      <div className="card small muted">{creatineMissMessage()}</div>

      <div className="section-label">Plan versions</div>
      <div className="card">
        <div className="small">
          Active: {activeVersion?.id ?? '—'} · {activeVersion?.reason}
        </div>
        <button
          className="btn btn-secondary btn-block"
          style={{ marginTop: 10 }}
          onClick={archivePlan}
        >
          Archive current & create new version
        </button>
        {planMsg && (
          <p className="small muted" style={{ marginTop: 8 }}>
            {planMsg}
          </p>
        )}
        <div className="section-label">History</div>
        {versions.map((v) => (
          <div key={v.id} className="small muted" style={{ marginBottom: 4 }}>
            {v.effectiveDate} · {v.archived ? 'Archived' : 'Active'} · {v.reason}
          </div>
        ))}
      </div>

      <div className="section-label">Your data</div>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>
          Logs live on this device only. Save a copy so nothing is lost if you clear
          the browser or switch phones.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={backupBusy}
          onClick={async () => {
            setBackupBusy(true)
            setBackupMsg('')
            try {
              const result = await shareOrDownloadBackup()
              setBackupMsg(
                result === 'shared'
                  ? 'Shared — pick Files or Drive to keep it.'
                  : 'Backup downloaded.',
              )
            } catch (err) {
              if (err instanceof DOMException && err.name === 'AbortError') {
                setBackupMsg('Share cancelled.')
              } else {
                setBackupMsg('Could not share — try download.')
              }
            } finally {
              setBackupBusy(false)
            }
          }}
        >
          Share / save backup
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={backupBusy}
          onClick={async () => {
            setBackupBusy(true)
            setBackupMsg('')
            try {
              const name = await downloadBackup()
              setBackupMsg(`Saved as ${name}`)
            } catch {
              setBackupMsg('Download failed.')
            } finally {
              setBackupBusy(false)
            }
          }}
        >
          Download JSON
        </button>
        <Link to="/data" className="btn btn-ghost btn-block">
          Import or manage backups →
        </Link>
        {backupMsg && (
          <p className="small" style={{ margin: 0 }}>
            {backupMsg}
          </p>
        )}
      </div>

      <div className="section-label">Edit plan</div>
      <Link to="/food-plan" className="btn btn-secondary btn-block">
        Edit food plan
      </Link>
      <Link to="/program" className="btn btn-secondary btn-block" style={{ marginTop: 8 }}>
        Edit program / exercises
      </Link>
      <Link to="/recipes" className="btn btn-secondary btn-block" style={{ marginTop: 8 }}>
        Recipe library
      </Link>
    </div>
  )
}

function ToggleRow({
  label,
  sub,
  on,
  onToggle,
}: {
  label: string
  sub?: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="card row-between" style={{ marginBottom: 8 }}>
      <div>
        <div>{label}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      <button type="button" className={`switch${on ? ' on' : ''}`} onClick={onToggle} />
    </div>
  )
}

function Field({
  label,
  value,
  onSave,
}: {
  label: string
  value: number | string
  onSave: (v: string) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <input
        className="input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() === String(value)) return
          onSave(draft.trim())
        }}
      />
    </div>
  )
}
