import { Modal } from './Modal'

export type CalorieToolChoice =
  | 'banana'
  | 'sattu'
  | 'pb_sandwich'
  | 'milk'
  | 'other'

const TOOLS: { id: CalorieToolChoice; label: string; sub?: string }[] = [
  { id: 'banana', label: 'Banana', sub: '~90 kcal · simple carbs' },
  { id: 'sattu', label: 'Sattu Drink', sub: 'Flexible calories + some protein' },
  { id: 'pb_sandwich', label: 'PB Sandwich', sub: 'Bread + peanut butter' },
  { id: 'milk', label: 'Milk / milk-powder drink', sub: 'Liquid calories' },
  { id: 'other', label: 'Other', sub: 'Pick from optional tools below' },
]

export function CalorieToolPickerModal({
  onCancel,
  onSelect,
}: {
  onCancel: () => void
  onSelect: (choice: CalorieToolChoice) => void
}) {
  return (
    <Modal
      title="Add food"
      subtitle={
        <>
          Prefer food tools before whey. Choose <strong>one</strong> convenient
          addition — do not stack everything.
        </>
      }
      onClose={onCancel}
      footer={
        <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
          Cancel
        </button>
      }
    >
      <div className="stack">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="check-row"
            onClick={() => onSelect(t.id)}
          >
            <span className="check-meta" style={{ flex: 1 }}>
              <span className="check-title">{t.label}</span>
              {t.sub && <span className="check-sub">{t.sub}</span>}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
