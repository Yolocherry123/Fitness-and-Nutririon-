import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, uid } from '../db'
import { deleteRecipe, saveRecipe } from '../hooks/useProgram'
import type { Recipe } from '../models/types'

const EMPTY: Omit<Recipe, 'id'> = {
  name: '',
  category: 'Custom',
  ingredients: [''],
  quantities: [''],
  preparation: '',
  substitutions: [],
  storage: '',
  nutritionNote: '',
}

export function RecipesScreen() {
  const recipes = useLiveQuery(() => db.recipes.toArray()) ?? []
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="page">
      <div className="row-between">
        <span className="muted small">Quick open while cooking</span>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          Add recipe
        </button>
      </div>
      <h1>Recipes</h1>
      <p className="muted small">
        Anabolic bowl, shakes, and your custom recipes — also in the bottom nav.
      </p>

      {recipes.length === 0 && (
        <p className="empty">No recipes yet. Add your first one.</p>
      )}

      {recipes.map((r) => (
        <article key={r.id} className="card" style={{ marginTop: 12 }}>
          <div className="row-between">
            <div className="chip">{r.category}</div>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(r)}>
                Edit
              </button>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  if (window.confirm(`Delete “${r.name}”?`)) {
                    await deleteRecipe(r.id)
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
          <h2 style={{ marginTop: 8 }}>{r.name}</h2>
          <div className="section-label" style={{ marginTop: 8 }}>
            Ingredients
          </div>
          <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
            {r.ingredients.map((ing, i) => (
              <li key={`${ing}-${i}`}>
                {ing}
                {r.quantities[i] ? ` — ${r.quantities[i]}` : ''}
              </li>
            ))}
          </ul>
          <div className="section-label">Preparation</div>
          <p className="small muted">{r.preparation || '—'}</p>
          {r.substitutions.length > 0 && (
            <>
              <div className="section-label">Substitutions</div>
              <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
                {r.substitutions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          <div className="section-label">Storage</div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {r.storage || '—'}
          </p>
          {r.nutritionNote && (
            <p className="faint small" style={{ marginTop: 8, marginBottom: 0 }}>
              {r.nutritionNote}
            </p>
          )}
        </article>
      ))}

      {(creating || editing) && (
        <RecipeForm
          initial={
            editing ?? {
              id: uid('recipe'),
              ...EMPTY,
            }
          }
          isNew={creating && !editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={async (recipe) => {
            await saveRecipe(recipe)
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function RecipeForm({
  initial,
  isNew,
  onClose,
  onSave,
}: {
  initial: Recipe
  isNew: boolean
  onClose: () => void
  onSave: (r: Recipe) => void
}) {
  const [name, setName] = useState(initial.name)
  const [category, setCategory] = useState(initial.category)
  const [ingredientsText, setIngredientsText] = useState(
    initial.ingredients.join('\n'),
  )
  const [quantitiesText, setQuantitiesText] = useState(
    initial.quantities.join('\n'),
  )
  const [preparation, setPreparation] = useState(initial.preparation)
  const [subsText, setSubsText] = useState(initial.substitutions.join('\n'))
  const [storage, setStorage] = useState(initial.storage)
  const [nutritionNote, setNutritionNote] = useState(initial.nutritionNote ?? '')

  function submit() {
    if (!name.trim()) return
    const ingredients = ingredientsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const quantities = quantitiesText.split('\n').map((s) => s.trim())
    const substitutions = subsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    onSave({
      id: initial.id,
      name: name.trim(),
      category: category.trim() || 'Custom',
      ingredients: ingredients.length ? ingredients : ['(add ingredients)'],
      quantities,
      preparation: preparation.trim(),
      substitutions,
      storage: storage.trim(),
      nutritionNote: nutritionNote.trim() || undefined,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'Add recipe' : 'Edit recipe'}</h2>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Category</label>
          <input
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Breakfast, Supplement…"
          />
        </div>
        <div className="field">
          <label>Ingredients (one per line)</label>
          <textarea
            className="input"
            rows={4}
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Quantities (one per line, same order)</label>
          <textarea
            className="input"
            rows={4}
            value={quantitiesText}
            onChange={(e) => setQuantitiesText(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Preparation</label>
          <textarea
            className="input"
            rows={3}
            value={preparation}
            onChange={(e) => setPreparation(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Substitutions (one per line)</label>
          <textarea
            className="input"
            rows={2}
            value={subsText}
            onChange={(e) => setSubsText(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Storage</label>
          <textarea
            className="input"
            rows={2}
            value={storage}
            onChange={(e) => setStorage(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Nutrition note (optional)</label>
          <input
            className="input"
            value={nutritionNote}
            onChange={(e) => setNutritionNote(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-block" onClick={submit}>
          Save
        </button>
        <button className="btn btn-ghost btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
