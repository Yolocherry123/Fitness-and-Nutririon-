import { useMemo, useState } from 'react'
import type { ProteinBreakdownLine, ProteinPortion } from '../models/types'
import {
  HOSTEL_PROTEIN_SOURCES,
  type ProteinSourceId,
  carbsForSource,
  proteinForSource,
} from '../lib/proteinDb'

const PORTIONS: ProteinPortion[] = ['small', 'normal', 'large']

export function MealProteinModal({
  title,
  subtitle,
  onCancel,
  onSave,
}: {
  title: string
  subtitle?: string
  onCancel: () => void
  onSave: (result: {
    estimatedProtein: number
    estimatedCarbs: number
    breakdown: ProteinBreakdownLine[]
    notes: string
  }) => void
}) {
  const [selected, setSelected] = useState<
    Partial<Record<ProteinSourceId, ProteinPortion | true>>
  >({})

  const totals = useMemo(() => {
    let protein = 0
    let carbs = 0
    for (const src of HOSTEL_PROTEIN_SOURCES) {
      const v = selected[src.id]
      if (!v) continue
      const portion = v === true ? 'normal' : v
      if (src.fixedG != null) protein += src.fixedG
      else protein += proteinForSource(src.id, portion)
      carbs += carbsForSource(src.id, portion)
    }
    return { protein, carbs }
  }, [selected])

  function toggle(id: ProteinSourceId, fixed: boolean) {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = fixed ? true : 'normal'
      return next
    })
  }

  function setPortion(id: ProteinSourceId, portion: ProteinPortion) {
    setSelected((prev) => ({ ...prev, [id]: portion }))
  }

  function save() {
    const breakdown: ProteinBreakdownLine[] = []
    for (const src of HOSTEL_PROTEIN_SOURCES) {
      const v = selected[src.id]
      if (!v) continue
      const portion = v === true ? undefined : v
      const grams =
        src.fixedG != null
          ? src.fixedG
          : proteinForSource(src.id, portion ?? 'normal')
      breakdown.push({
        label: src.label,
        grams,
        portion,
        source: 'APPROXIMATION',
      })
    }
    onSave({
      estimatedProtein: totals.protein,
      estimatedCarbs: totals.carbs,
      breakdown,
      notes:
        breakdown.length > 0
          ? `Protein sources: ${breakdown.map((b) => b.label).join(', ')}`
          : 'Marked consumed (no protein sources selected — estimate low)',
    })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="muted small">
          {subtitle ??
            'Select what you actually ate. Estimates are approximate — not exact lab values.'}
        </p>

        <div className="stack" style={{ marginTop: 10, maxHeight: '50vh', overflow: 'auto' }}>
          {HOSTEL_PROTEIN_SOURCES.map((src) => {
            const on = !!selected[src.id]
            const portion =
              selected[src.id] && selected[src.id] !== true
                ? (selected[src.id] as ProteinPortion)
                : 'normal'
            return (
              <div key={src.id} className="card" style={{ padding: '10px 12px' }}>
                <label className="check-row" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(src.id, src.fixedG != null)}
                  />
                  <span className="check-title" style={{ fontWeight: 500 }}>
                    {src.label}
                    {src.fixedG != null ? ` · ~${src.fixedG} g` : ''}
                  </span>
                </label>
                {on && src.byPortion && (
                  <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {PORTIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`chip${portion === p ? ' on' : ''}`}
                        style={{
                          borderColor: portion === p ? 'var(--accent)' : undefined,
                          color: portion === p ? 'var(--accent)' : undefined,
                        }}
                        onClick={() => setPortion(src.id, p)}
                      >
                        {p} (~{src.byPortion![p]} g)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="small" style={{ marginTop: 12 }}>
          Est. protein <strong>~{totals.protein} g</strong>
          {' · '}
          carbs <strong>~{totals.carbs} g</strong>
        </p>

        <button type="button" className="btn btn-primary btn-block" onClick={save}>
          Save meal
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() =>
            onSave({
              estimatedProtein: 0,
              estimatedCarbs: 0,
              breakdown: [],
              notes: 'Consumed — protein sources not logged',
            })
          }
        >
          Skip details (checklist only)
        </button>
      </div>
    </div>
  )
}
