import { useEffect, useRef, useState } from 'react'
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
  const selectedRef = useRef<HTMLDivElement | null>(null)
  const snack = EXTRA_SNACK_SOURCES.find((s) => s.id === snackId)
  const protein = proteinForExtraSnack(snackId, portion)
  const carbs = carbsForExtraSnack(snackId, portion)
  const label = snack?.label ?? 'Extra snack'

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [snackId])

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
        {EXTRA_SNACK_SOURCES.map((s) => {
          const selected = snackId === s.id
          return (
            <div
              key={s.id}
              ref={selected ? selectedRef : undefined}
              className="card"
              style={{ padding: '10px 12px' }}
            >
              <button
                type="button"
                className={`check-row${selected ? ' done' : ''}`}
                style={{ margin: 0, padding: '6px 0' }}
                onClick={() => setSnackId(s.id)}
              >
                <span className="check-box">{selected ? '✓' : ''}</span>
                <span className="check-meta">
                  <span className="check-title">{s.label}</span>
                  <span className="check-sub">
                    {s.sub ? `${s.sub} · ` : ''}~{s.byPortion.normal} g protein
                    (normal)
                  </span>
                </span>
              </button>
              {selected && (
                <div
                  className="row"
                  style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}
                >
                  {PORTIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`chip${portion === p.id ? ' on' : ''}`}
                      onClick={() => setPortion(p.id)}
                    >
                      {p.label} · ~{proteinForExtraSnack(s.id, p.id)} g
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
        Estimated · ~{protein} g protein · ~{carbs} g carbs
      </p>
    </Modal>
  )
}
