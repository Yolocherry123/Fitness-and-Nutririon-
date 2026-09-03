import type {
  AppSettings,
  DailyCompletion,
  FoodAction,
  UserProfile,
} from '../models/types'
import {
  DEFAULT_WHEY_PROTEIN_G,
  proteinForSource,
} from '../lib/proteinDb'
import { isWheyAction } from './logic'
import type { ProteinSummary } from './protein'

export const EGGS_ACTION_ID = 'protein-addon-eggs'

export type ProteinSuggestionKind = 'eggs' | 'night_dairy' | 'whey'

export interface ProteinChecklistSuggestion {
  kind: ProteinSuggestionKind
  action: FoodAction
  hint: string
  estimatedProteinG: number
}

export function isEggsAddOnAction(
  action: Pick<FoodAction, 'id' | 'name'>,
): boolean {
  return (
    action.id === EGGS_ACTION_ID ||
    /^add eggs\b/i.test(action.name) ||
    /\beggs?\s*\(/i.test(action.name)
  )
}

export function isNightDairyAction(action: Pick<FoodAction, 'name'>): boolean {
  return /night milk|curd/i.test(action.name)
}

function eggCountForGap(gap: number): 1 | 2 | 3 {
  if (gap <= 9) return 1
  if (gap <= 16) return 2
  return 3
}

function syntheticEggsAction(count: 1 | 2 | 3, _hint: string): FoodAction {
  const grams = proteinForSource(
    count === 1 ? 'eggs_1' : count === 2 ? 'eggs_2' : 'eggs_3',
  )
  return {
    id: EGGS_ACTION_ID,
    name: `Add eggs (${count})`,
    dayOfWeek: null,
    timeWindow: 'Afternoon',
    category: 'OPTIONAL',
    sortOrder: 49,
    quantity: `${count}`,
    unit: count === 1 ? 'egg' : 'eggs',
    estimatedProteinG: grams,
    notes: 'Convenient food protein — not required daily. Log when you eat them.',
  }
}

function syntheticWheyAction(hint: string): FoodAction {
  return {
    id: 'shake-extra',
    name: 'Whey shake (suggested for today)',
    dayOfWeek: null,
    timeWindow: 'Supplements',
    category: 'OPTIONAL',
    sortOrder: 61,
    estimatedProteinG: DEFAULT_WHEY_PROTEIN_G,
    notes: hint,
  }
}

/**
 * Food-first protein add-ons for the Today checklist.
 * At most two suggestions: one convenient food source, then whey if still useful.
 */
export function buildProteinChecklistSuggestions(input: {
  protein: ProteinSummary
  actions: FoodAction[]
  completions: DailyCompletion[]
  profile?: Pick<UserProfile, 'usesWhey'> | null
  settings?: AppSettings | null
}): ProteinChecklistSuggestion[] {
  const { protein, actions, completions, profile, settings } = input
  const doneIds = new Set(
    completions.filter((c) => c.completed).map((c) => c.foodActionId),
  )

  const wheyFromPlan = actions.find(isWheyAction)
  const wheyLogged =
    doneIds.has('shake-extra') ||
    (!!wheyFromPlan && doneIds.has(wheyFromPlan.id)) ||
    completions.some(
      (c) =>
        c.completed &&
        isWheyAction({ id: c.foodActionId, name: c.notes ?? '' }),
    )
  const eggsLogged = doneIds.has(EGGS_ACTION_ID)
  const nightDairy = actions.find(isNightDairyAction)
  const nightDairyDone = nightDairy ? doneIds.has(nightDairy.id) : true

  const gap = Math.max(
    0,
    Math.round((protein.minimumTarget - protein.expectedDailyProtein) * 10) /
      10,
  )
  const projectedShort = gap > 0
  const late = protein.hour >= 19
  const out: ProteinChecklistSuggestion[] = []

  // Keep completed add-ons visible so they can be unticked.
  let foodProtein = 0
  if (eggsLogged) {
    const existing = completions.find(
      (c) => c.foodActionId === EGGS_ACTION_ID && c.completed,
    )
    const grams = existing?.estimatedProtein ?? 12
    foodProtein = grams
    out.push({
      kind: 'eggs',
      action: syntheticEggsAction(
        grams >= 17 ? 3 : grams >= 11 ? 2 : 1,
        'Logged today.',
      ),
      hint: 'Logged today.',
      estimatedProteinG: grams,
    })
  }
  if (wheyLogged) {
    const wheyAction = wheyFromPlan ?? syntheticWheyAction('Logged today.')
    out.push({
      kind: 'whey',
      action: wheyAction,
      hint: 'Logged today.',
      estimatedProteinG:
        settings?.wheyProteinPerServingG ?? DEFAULT_WHEY_PROTEIN_G,
    })
  }

  if (!projectedShort && !protein.suggestShakeForCalories) {
    return dedupeSuggestions(out).slice(0, 2)
  }

  // --- Food-first suggestion (skip if eggs already logged) ---
  if (!eggsLogged && projectedShort) {
    if (late && nightDairy && !nightDairyDone) {
      const dairyG = defaultNightDairyProtein(nightDairy)
      out.push({
        kind: 'night_dairy',
        action: nightDairy,
        hint: `Suggested for protein — ~${dairyG}g if dinner was light.`,
        estimatedProteinG: dairyG,
      })
      foodProtein = Math.max(foodProtein, dairyG)
    } else {
      const count = eggCountForGap(gap)
      const grams = proteinForSource(
        count === 1 ? 'eggs_1' : count === 2 ? 'eggs_2' : 'eggs_3',
      )
      const hint =
        protein.status === 'EARLY_DAY' || protein.foodFirst
          ? `Projected short after planned meals — keep ~${grams}g from eggs ready.`
          : `Suggested for protein — ~${grams}g convenient food add-on.`
      out.push({
        kind: 'eggs',
        action: syntheticEggsAction(count, hint),
        hint,
        estimatedProteinG: grams,
      })
      foodProtein = Math.max(foodProtein, grams)
    }
  }

  // --- Whey only if still useful after food (or calorie path) ---
  if (
    profile?.usesWhey &&
    !wheyLogged &&
    !out.some((s) => s.kind === 'whey')
  ) {
    const remainingAfterFood = gap - foodProtein
    const wheyG = settings?.wheyProteinPerServingG ?? DEFAULT_WHEY_PROTEIN_G
    const wantWheyForProtein =
      protein.suggestShakeForProtein ||
      remainingAfterFood > 10 ||
      (projectedShort && foodProtein === 0)
    const wantWheyForCalories = protein.suggestShakeForCalories

    if (wantWheyForProtein || wantWheyForCalories) {
      const hint =
        wantWheyForCalories && !wantWheyForProtein
          ? 'Protein OK — whey optional for calories/convenience.'
          : remainingAfterFood > 10 && foodProtein > 0
            ? `Food helps, but ~${Math.round(remainingAfterFood)}g may remain — whey closes it.`
            : protein.suggestShakeForProtein
              ? 'Suggested for protein — prepare a scoop when useful.'
              : 'Projected short after planned meals — keep whey ready.'
      out.push({
        kind: 'whey',
        action: wheyFromPlan ?? syntheticWheyAction(hint),
        hint,
        estimatedProteinG: wheyG,
      })
    }
  }

  return dedupeSuggestions(out).slice(0, 2)
}

function dedupeSuggestions(
  items: ProteinChecklistSuggestion[],
): ProteinChecklistSuggestion[] {
  const seen = new Set<string>()
  const deduped: ProteinChecklistSuggestion[] = []
  for (const s of items) {
    if (seen.has(s.action.id)) continue
    seen.add(s.action.id)
    deduped.push(s)
  }
  return deduped
}

function defaultNightDairyProtein(action: FoodAction): number {
  if (action.estimatedProteinG != null) return action.estimatedProteinG
  return proteinForSource('milk', 'normal')
}
