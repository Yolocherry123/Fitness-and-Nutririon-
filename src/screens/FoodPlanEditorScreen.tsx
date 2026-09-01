import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryBadge } from '../components/Badges'
import { Modal } from '../components/Modal'
import { db } from '../db'
import {
  addFoodAction,
  deleteFoodAction,
  defaultSortForWindow,
  saveFoodAction,
} from '../lib/foodPlan'
import { TIME_WINDOWS, WINDOW_LABELS, foodActionsForDay } from '../lib/food'
import type { ActionCategory, DayOfWeek, FoodAction } from '../models/types'
import { DAYS } from '../models/types'

const ABBR: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
}

const CATEGORIES: ActionCategory[] = ['CORE', 'SCHEDULED', 'OPTIONAL', 'SUBSTITUTE']

export function FoodPlanEditorScreen() {
  const [day, setDay] = useState<DayOfWeek>('Monday')
  const allFood = useLiveQuery(() => db.foodActions.toArray()) ?? []
  const actions = useMemo(() => foodActionsForDay(allFood, day), [allFood, day])

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<FoodAction | null>(null)
  const [msg, setMsg] = useState('')

  return (
    <div className="page">
      <div className="row-between">
        <Link to="/plan" className="btn btn-ghost">
          ← Plan
        </Link>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          Add item
        </button>
      </div>
      <h1>Edit food plan</h1>
      <p className="muted small">
        Change what shows on each day — time slot, CORE/SCHEDULED/OPTIONAL, notes. Today
        updates immediately.
      </p>
      {msg && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {msg}
        </p>
      )}

      <div className="day-strip" style={{ marginTop: 12 }}>
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            className={`day-chip${day === d ? ' selected' : ''}`}
            onClick={() => setDay(d)}
          >
            <div className="day-abbr">{ABBR[d]}</div>
          </button>
        ))}
      </div>

      <div className="card card-strong" style={{ marginBottom: 12 }}>
        <div className="check-title">{day}</div>
        <div className="check-sub">
          {actions.length} items · green = every day · amber = this day only
        </div>
      </div>

      {TIME_WINDOWS.map((slot) => {
        const items = actions.filter((a) => a.timeWindow === slot)
        if (!items.length) return null
        return (
          <div key={slot}>
            <div className="section-label">{WINDOW_LABELS[slot] ?? slot}</div>
            {items.map((a) => (
              <div
                key={a.id}
                className={`check-row cat-${a.category.toLowerCase()}`}
                style={{ marginBottom: 8, cursor: 'default' }}
              >
                <span className="check-meta" style={{ flex: 1 }}>
                  <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span className="check-title">{a.name}</span>
                    <CategoryBadge category={a.category} />
                    <span className="chip">
                      {a.dayOfWeek === null ? 'Every day' : a.dayOfWeek.slice(0, 3)}
                    </span>
                  </span>
                  {(a.quantity || a.notes) && (
                    <span className="check-sub">
                      {a.quantity ? `${a.quantity}${a.unit ? ` ${a.unit}` : ''} · ` : ''}
                      {a.notes}
                    </span>
                  )}
                  <div className="row" style={{ marginTop: 8, gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setEditing(a)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={async () => {
                        if (!globalThis.confirm(`Remove “${a.name}” from the plan?`)) return
                        await deleteFoodAction(a.id)
                        setMsg(`Removed “${a.name}”.`)
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </span>
              </div>
            ))}
          </div>
        )
      })}

      {actions.length === 0 && (
        <p className="empty">Nothing on {day} yet. Add an item.</p>
      )}

      {(adding || editing) && (
        <FoodActionForm
          title={adding ? `Add to ${day}` : 'Edit food item'}
          initial={
            editing ?? {
              id: '',
              name: '',
              dayOfWeek: day,
              timeWindow: 'Breakfast',
              category: 'CORE',
              sortOrder: defaultSortForWindow('Breakfast'),
            }
          }
          defaultDay={day}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSave={async (action) => {
            if (editing) {
              await saveFoodAction(action)
              setMsg(`Updated “${action.name}”.`)
            } else {
              await addFoodAction({
                name: action.name,
                dayOfWeek: action.dayOfWeek,
                timeWindow: action.timeWindow,
                category: action.category,
                quantity: action.quantity,
                unit: action.unit,
                notes: action.notes,
                sortOrder: action.sortOrder,
                allowsMilkPowderSub: action.allowsMilkPowderSub,
              })
              setMsg(`Added “${action.name}”.`)
            }
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function FoodActionForm({
  title,
  initial,
  defaultDay,
  onClose,
  onSave,
}: {
  title: string
  initial: FoodAction
  defaultDay: DayOfWeek
  onClose: () => void
  onSave: (a: FoodAction) => void
}) {
  const [name, setName] = useState(initial.name)
  const [everyDay, setEveryDay] = useState(initial.dayOfWeek === null)
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(
    initial.dayOfWeek ?? defaultDay,
  )
  const [timeWindow, setTimeWindow] = useState(initial.timeWindow)
  const [category, setCategory] = useState<ActionCategory>(initial.category)
  const [quantity, setQuantity] = useState(initial.quantity ?? '')
  const [unit, setUnit] = useState(initial.unit ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [sortOrder, setSortOrder] = useState(
    initial.sortOrder || defaultSortForWindow(initial.timeWindow),
  )
  const [milkPowder, setMilkPowder] = useState(!!initial.allowsMilkPowderSub)

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              if (!name.trim()) return
              onSave({
                ...initial,
                id: initial.id || 'temp',
                name: name.trim(),
                dayOfWeek: everyDay ? null : dayOfWeek,
                timeWindow,
                category,
                quantity: quantity.trim() || undefined,
                unit: unit.trim() || undefined,
                notes: notes.trim() || undefined,
                sortOrder,
                allowsMilkPowderSub: milkPowder || undefined,
              })
            }}
          >
            Save
          </button>
          <button className="btn btn-ghost btn-block" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
        <div className="field">
          <label>Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hostel breakfast"
          />
        </div>

        <div className="card row-between" style={{ marginBottom: 12 }}>
          <div>
            <div>Every day</div>
            <div className="small muted">Off = only the selected weekday</div>
          </div>
          <button
            type="button"
            className={`switch${everyDay ? ' on' : ''}`}
            onClick={() => setEveryDay((v) => !v)}
          />
        </div>

        {!everyDay && (
          <div className="field">
            <label>Day</label>
            <select
              className="select"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label>Time window</label>
          <select
            className="select"
            value={timeWindow}
            onChange={(e) => {
              setTimeWindow(e.target.value)
              setSortOrder(defaultSortForWindow(e.target.value))
            }}
          >
            {TIME_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {WINDOW_LABELS[w] ?? w}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Category</label>
          <select
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value as ActionCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <p className="faint small" style={{ marginTop: -6 }}>
          OPTIONAL never lowers your success score. SCHEDULED = planned that day (e.g.
          chicken).
        </p>

        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 2 }}>
            <label>Quantity</label>
            <input
              className="input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="300–350"
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Unit</label>
            <input
              className="input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="g"
            />
          </div>
        </div>

        <div className="field">
          <label>Notes</label>
          <textarea
            className="input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Sort order (lower = earlier)</label>
          <input
            className="input"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </div>

        <div className="card row-between" style={{ marginBottom: 0 }}>
          <span>Allow milk powder as substitute note</span>
          <button
            type="button"
            className={`switch${milkPowder ? ' on' : ''}`}
            onClick={() => setMilkPowder((v) => !v)}
          />
        </div>
    </Modal>
  )
}
