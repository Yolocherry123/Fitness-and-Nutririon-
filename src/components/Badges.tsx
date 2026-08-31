import type { ActionCategory, ExerciseSourceStatus } from '../models/types'

export function CategoryBadge({ category }: { category: ActionCategory }) {
  const cls =
    category === 'CORE'
      ? 'badge-core'
      : category === 'SCHEDULED'
        ? 'badge-scheduled'
        : category === 'OPTIONAL'
          ? 'badge-optional'
          : 'badge-optional'
  return <span className={`badge ${cls}`}>{category}</span>
}

export function SourceBadge({ status }: { status: ExerciseSourceStatus }) {
  if (status === 'CONFIRMED')
    return <span className="badge badge-confirmed">Confirmed</span>
  if (status === 'RECONSTRUCTED')
    return <span className="badge badge-reconstructed">Reconstruction</span>
  return <span className="badge badge-custom">Custom</span>
}
