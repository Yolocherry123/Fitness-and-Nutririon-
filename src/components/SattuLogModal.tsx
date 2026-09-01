import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import type { AppSettings, SattuLiquidType, SattuRecipeType } from '../models/types'
import {
  DEFAULT_SATTU_SERVING_G,
  estimateSattuNutrition,
  SATTU_RECIPE_LABELS,
} from '../lib/sattuDb'

const RECIPES: { id: SattuRecipeType; label: string }[] = [
  { id: 'basic', label: 'Basic Sattu Drink' },
  { id: 'sweet', label: 'Sweet Sattu Shake' },
  { id: 'savory', label: 'Savory Sattu Drink' },
  { id: 'custom', label: 'Custom' },
]

const AMOUNTS = [30, 40, 50] as const

const LIQUIDS: { id: SattuLiquidType; label: string }[] = [
  { id: 'water', label: 'Water' },
  { id: 'milk', label: 'Milk' },
  { id: 'milk_powder', label: 'Milk-powder drink' },
]

export function SattuLogModal({
  settings,
  reason,
  fiberWarning,
  onCancel,
  onSave,
}: {
  settings?: AppSettings | null
  reason: 'calories' | 'convenience' | 'protein_caveat'
  fiberWarning?: boolean
  onCancel: () => void
  onSave: (result: {
    estimatedProtein: number
    estimatedCarbs: number
    estimatedCalories: number
    breakdown: import('../models/types').ProteinBreakdownLine[]
    notes: string
    recipeType: SattuRecipeType
    amountG: number
  }) => void
}) {
  const [recipeType, setRecipeType] = useState<SattuRecipeType>('basic')
  const [amountG, setAmountG] = useState<number>(DEFAULT_SATTU_SERVING_G)
  const [customAmount, setCustomAmount] = useState('')
  const [liquid, setLiquid] = useState<SattuLiquidType>('water')
  const [addBanana, setAddBanana] = useState(false)
  const [customProtein, setCustomProtein] = useState('12')
  const [customCalories, setCustomCalories] = useState('150')

  const effectiveAmount =
    recipeType === 'custom'
      ? Number(customAmount) || DEFAULT_SATTU_SERVING_G
      : amountG

  const calc = useMemo(
    () =>
      estimateSattuNutrition({
        recipeType,
        amountG: effectiveAmount,
        liquid: recipeType === 'sweet' ? liquid : 'water',
        addBanana: recipeType === 'sweet' && addBanana,
        customProtein: Number(customProtein) || 0,
        customCalories: Number(customCalories) || undefined,
        settings,
      }),
    [
      recipeType,
      effectiveAmount,
      liquid,
      addBanana,
      customProtein,
      customCalories,
      settings,
    ],
  )

  const why =
    reason === 'calories'
      ? 'Suggested as a convenient calorie addition — not a primary protein fix.'
      : reason === 'protein_caveat'
        ? 'Sattu adds some protein, but may not close a large gap on its own.'
        : 'Flexible optional nutrition tool — log when useful.'

  return (
    <Modal
      title="Log Sattu drink"
      subtitle={`${why} Values estimated from your product settings.`}
      onClose={onCancel}
      footer={
        <>
          <p className="small" style={{ margin: 0 }}>
            Estimated: <strong>~{calc.protein} g protein</strong>
            {calc.carbs > 0 ? ` · ~${calc.carbs} g carbs` : ''}
            {calc.calories > 0 ? ` · ~${calc.calories} kcal` : ''}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              const label = SATTU_RECIPE_LABELS[recipeType]
              onSave({
                estimatedProtein: calc.protein,
                estimatedCarbs: calc.carbs,
                estimatedCalories: calc.calories,
                breakdown: calc.breakdown,
                notes: `Sattu · ${label}`,
                recipeType,
                amountG: effectiveAmount,
              })
            }}
          >
            Log sattu
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      {fiberWarning && (
        <p className="small" style={{ margin: '0 0 10px', color: 'var(--warn)' }}>
          Consider simplifying optional additions today — you already logged other
          high-fiber items.
        </p>
      )}

      <div className="section-label" style={{ marginTop: 0 }}>
        Recipe
      </div>
      <div className="stack">
        {RECIPES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`check-row${recipeType === r.id ? ' done' : ''}`}
            onClick={() => setRecipeType(r.id)}
          >
            <span className="check-box">{recipeType === r.id ? '✓' : ''}</span>
            <span className="check-title">{r.label}</span>
          </button>
        ))}
      </div>

      {recipeType !== 'custom' && (
        <>
          <div className="section-label">Sattu amount (g)</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {AMOUNTS.map((g) => (
              <button
                key={g}
                type="button"
                className={`chip${amountG === g ? ' on' : ''}`}
                onClick={() => setAmountG(g)}
              >
                {g} g
              </button>
            ))}
          </div>
        </>
      )}

      {recipeType === 'custom' && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Estimated protein (g)</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={customProtein}
            onChange={(e) => setCustomProtein(e.target.value)}
          />
          <label style={{ marginTop: 8 }}>Estimated calories</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={customCalories}
            onChange={(e) => setCustomCalories(e.target.value)}
          />
        </div>
      )}

      {recipeType === 'sweet' && (
        <>
          <div className="section-label">Liquid</div>
          <div className="stack">
            {LIQUIDS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`check-row${liquid === l.id ? ' done' : ''}`}
                onClick={() => setLiquid(l.id)}
              >
                <span className="check-box">{liquid === l.id ? '✓' : ''}</span>
                <span className="check-title">{l.label}</span>
              </button>
            ))}
          </div>
          <label className="check-row" style={{ marginTop: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={addBanana}
              onChange={(e) => setAddBanana(e.target.checked)}
            />
            <span className="check-title" style={{ marginLeft: 8 }}>
              Add banana (+~90 kcal)
            </span>
          </label>
        </>
      )}
    </Modal>
  )
}
