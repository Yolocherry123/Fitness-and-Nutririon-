import { useState } from 'react'
import { Modal } from './Modal'
import {
  carbsForSource,
  proteinForSource,
  type ProteinSourceId,
} from '../lib/proteinDb'
import type { ProteinBreakdownLine } from '../models/types'

const EGG_OPTIONS: { id: ProteinSourceId; count: 1 | 2 | 3; label: string }[] =
  [
    { id: 'eggs_1', count: 1, label: '1 egg' },
    { id: 'eggs_2', count: 2, label: '2 eggs' },
    { id: 'eggs_3', count: 3, label: '3 eggs' },
  ]

export function ProteinAddOnModal({
  title,
  subtitle,
  initialCount = 2,
  onCancel,
  onSave,
}: {
  title: string
  subtitle?: string
  initialCount?: 1 | 2 | 3
  onCancel: () => void
  onSave: (result: {
    estimatedProtein: number
    estimatedCarbs: number
    breakdown: ProteinBreakdownLine[]
    notes: string
    eggCount: 1 | 2 | 3
  }) => void
}) {
  const [count, setCount] = useState<1 | 2 | 3>(initialCount)
  const sourceId: ProteinSourceId =
    count === 1 ? 'eggs_1' : count === 2 ? 'eggs_2' : 'eggs_3'
  const protein = proteinForSource(sourceId)
  const carbs = carbsForSource(sourceId)

  return (
    <Modal
      title={title}
      subtitle={
        subtitle ??
        'Convenient food protein — log what you actually eat. Estimates only.'
      }
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() =>
              onSave({
                estimatedProtein: protein,
                estimatedCarbs: carbs,
                eggCount: count,
                breakdown: [
                  {
                    label: EGG_OPTIONS.find((o) => o.count === count)?.label ?? 'Eggs',
                    grams: protein,
                    source: 'APPROXIMATION',
                  },
                ],
                notes: `Eggs · ${count}`,
              })
            }
          >
            Log eggs
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      <div className="stack">
        {EGG_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`check-row${count === o.count ? ' done' : ''}`}
            onClick={() => setCount(o.count)}
          >
            <span className="check-box">{count === o.count ? '✓' : ''}</span>
            <span className="check-meta">
              <span className="check-title">{o.label}</span>
              <span className="check-sub">
                ~{proteinForSource(o.id)} g protein
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
        Estimated protein: ~{protein} g
      </p>
    </Modal>
  )
}
