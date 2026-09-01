import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import type { AppSettings, ProteinBreakdownLine, ShakeStyle } from '../models/types'
import {
  DEFAULT_MILK_GLASS_PROTEIN_G,
  DEFAULT_MILK_POWDER_PROTEIN_G,
  DEFAULT_WHEY_CALORIES,
  DEFAULT_WHEY_PROTEIN_G,
} from '../lib/proteinDb'

const STYLES: { id: ShakeStyle; label: string }[] = [
  { id: 'whey_water', label: 'Whey + water' },
  { id: 'whey_milk', label: 'Whey + milk' },
  { id: 'whey_milk_powder', label: 'Whey + milk-powder drink' },
  { id: 'whey_banana', label: 'Whey + banana' },
  { id: 'custom', label: 'Custom shake' },
]

export function ShakeLogModal({
  settings,
  reason,
  onCancel,
  onSave,
}: {
  settings?: AppSettings | null
  reason: 'protein' | 'calories' | 'convenience'
  onCancel: () => void
  onSave: (result: {
    estimatedProtein: number
    estimatedCarbs?: number
    estimatedCalories?: number
    breakdown: ProteinBreakdownLine[]
    notes: string
    style: ShakeStyle
  }) => void
}) {
  const [style, setStyle] = useState<ShakeStyle>('whey_water')
  const [customProtein, setCustomProtein] = useState('24')

  const wheyP = settings?.wheyProteinPerServingG ?? DEFAULT_WHEY_PROTEIN_G
  const wheyC = settings?.wheyCaloriesPerServing ?? DEFAULT_WHEY_CALORIES
  const milkP = settings?.milkProteinPerGlassG ?? DEFAULT_MILK_GLASS_PROTEIN_G
  const mpP = settings?.milkPowderProteinPerServingG ?? DEFAULT_MILK_POWDER_PROTEIN_G

  const calc = useMemo(() => {
    if (style === 'custom') {
      const p = Number(customProtein) || 0
      return { protein: p, calories: undefined as number | undefined, carbs: 0 }
    }
    let protein = wheyP
    let calories = wheyC
    let carbs = 3
    if (style === 'whey_milk') {
      protein += milkP
      calories += 120
      carbs += 12
    } else if (style === 'whey_milk_powder') {
      protein += mpP
      calories += 100
      carbs += 10
    } else if (style === 'whey_banana') {
      protein += 1
      calories += 90
      carbs += 27
    }
    return { protein, calories, carbs }
  }, [style, customProtein, wheyP, wheyC, milkP, mpP])

  const why =
    reason === 'protein'
      ? 'Suggested because protein is likely low.'
      : reason === 'calories'
        ? 'Protein looks fine — this shake is for calories / convenience.'
        : 'Logged as a convenient protein tool.'

  function handleSave() {
    const breakdown: ProteinBreakdownLine[] = [
      {
        label: STYLES.find((s) => s.id === style)?.label ?? 'Shake',
        grams: calc.protein,
        source: style === 'custom' ? 'USER_CUSTOM' : 'PRODUCT_LABEL',
      },
    ]
    onSave({
      estimatedProtein: calc.protein,
      estimatedCarbs: calc.carbs,
      estimatedCalories: calc.calories,
      breakdown,
      notes: `Shake · ${STYLES.find((s) => s.id === style)?.label}`,
      style,
    })
  }

  return (
    <Modal
      title="Add protein shake"
      subtitle={`${why} All values are estimated from your product settings.`}
      onClose={onCancel}
      footer={
        <>
          <p className="small" style={{ margin: 0 }}>
            Estimated protein: <strong>~{calc.protein} g</strong>
            {calc.carbs > 0 ? ` · carbs ~${calc.carbs} g` : ''}
            {calc.calories != null ? ` · ~${calc.calories} kcal` : ''}
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={handleSave}>
            Log shake
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      <div className="stack">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`check-row${style === s.id ? ' done' : ''}`}
            onClick={() => setStyle(s.id)}
          >
            <span className="check-box">{style === s.id ? '✓' : ''}</span>
            <span className="check-title">{s.label}</span>
          </button>
        ))}
      </div>

      {style === 'custom' && (
        <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
          <label>Estimated protein (g)</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={customProtein}
            onChange={(e) => setCustomProtein(e.target.value)}
          />
        </div>
      )}
    </Modal>
  )
}
