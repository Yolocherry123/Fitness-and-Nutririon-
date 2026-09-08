import { useState } from 'react'
import { Modal } from './Modal'
import {
  EXTRA_SNACK_SOURCES,
  carbsForExtraSnack,
  proteinForExtraSnack,
  type ExtraSnackId,
} from '../lib/proteinDb'
import type { ProteinBreakdownLine, ProteinPortion } from '../models/types'

const PORTIONS: { id: ProteinPortion; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Large' },
]

export function ExtraSnackModal({
  title = 'Extra snack',
  subtitle,
  initialSnack = 'roasted_peanuts',
  initialPortion = 'normal',
  onCancel,
  onSave,
}: {
  title?: string
  subtitle?: string
  initialSnack?: ExtraSnackId
  initialPortion?: ProteinPortion
  onCancel: () => void
  onSave: (result: {
    snackId: ExtraSnackId
    portion: ProteinPortion
    estimatedProtein: number
    estimatedCarbs: number
    breakdown: ProteinBreakdownLine[]
    notes: string
    label: string
  }) => void
}) {
  const [snackId, setSnackId] = useState<ExtraSnackId>(initialSnack)
  const [portion, setPortion] = useState<ProteinPortion>(initialPortion)
  const snack = EXTRA_SNACK_SOURCES.find((s) => s.id === snackId)
  const protein = proteinForExtraSnack(snackId, portion)
  const carbs = carbsForExtraSnack(snackId, portion)
  const label = snack?.label ?? 'Extra snack'

  return (
    <Modal
      title={title}
      subtitle={
        subtitle ??
        'Log a small snack or extra bite toward protein — roasted peanuts, nuts, paneer, and similar. Estimates only.'
      }
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() =>
              onSave({
                snackId,
                portion,
                estimatedProtein: protein,
                estimatedCarbs: carbs,
                label,
                breakdown: [
                  {
                    label: `${label} (${portion})`,
                    grams: protein,
                    portion,
                    source: 'APPROXIMATION',
                  },
                ],
                notes: `Extra snack · ${label} · ${portion}`,
              })
            }
          >
            Log snack · ~{protein} g protein
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      <div className="stack">
        {EXTRA_SNACK_SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`check-row${snackId === s.id ? ' done' : ''}`}
            onClick={() => setSnackId(s.id)}
          >
            <span className="check-box">{snackId === s.id ? '✓' : ''}</span>
            <span className="check-meta">
              <span className="check-title">{s.label}</span>
              <span className="check-sub">
                {s.sub ? `${s.sub} · ` : ''}~{s.byPortion.normal} g protein (normal)
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="section-label" style={{ marginTop: 14 }}>
        Portion
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {PORTIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${portion === p.id ? ' on' : ''}`}
            onClick={() => setPortion(p.id)}
          >
            {p.label} · ~{proteinForExtraSnack(snackId, p.id)} g
          </button>
        ))}
      </div>

      <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
        Estimated · ~{protein} g protein · ~{carbs} g carbs
      </p>
    </Modal>
  )
}
