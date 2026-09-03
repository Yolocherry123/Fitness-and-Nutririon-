import type {
  AppSettings,
  DailyCompletion,
  FoodAction,
  UserProfile,
} from '../models/types'
import { SATTU_ACTION_ID } from '../models/types'
import {
  DEFAULT_WHEY_PROTEIN_G,
  defaultCarbsForActionName,
  defaultProteinForActionName,
  proteinForSource,
} from '../lib/proteinDb'
import { isWheyAction } from './logic'
import type { ProteinSummary } from './protein'

export const EGGS_ACTION_ID = 'protein-addon-eggs'

export type GapSuggestionKind =
  | 'eggs'
  | 'sattu'
  | 'banana'
  | 'night_dairy'
  | 'whey'

export interface ProteinChecklistSuggestion {
  kind: GapSuggestionKind
  action: FoodAction
  hint: string
  estimatedProteinG: number
  estimatedCarbsG?: number
  goal: 'protein' | 'carbs' | 'calories' | 'logged'
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

export function isSattuFoodAction(
  action: Pick<FoodAction, 'id' | 'name'>,
): boolean {
  return action.id === SATTU_ACTION_ID || /sattu/i.test(action.name)
}

export function isBananaFoodAction(action: Pick<FoodAction, 'name'>): boolean {
  return /banana/i.test(action.name) && !/pre-workout/i.test(action.name)
}

function eggCountForGap(gap: number): 1 | 2 | 3 {
  if (gap <= 9) return 1
  if (gap <= 16) return 2
  return 3
}

function syntheticEggsAction(count: 1 | 2 | 3): FoodAction {
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
    notes:
      'Convenient food protein — prefer this before whey. Log when you eat them.',
  }
}

function syntheticWheyAction(hint: string): FoodAction {
  return {
    id: 'shake-extra',
    name: 'Whey shake (last resort)',
    dayOfWeek: null,
    timeWindow: 'Supplements',
    category: 'OPTIONAL',
    sortOrder: 61,
    estimatedProteinG: DEFAULT_WHEY_PROTEIN_G,
    notes: hint,
  }
}

/**
 * Gap-fill checklist suggestions.
 * Prefer real food optionals (eggs, sattu, banana, night dairy). Whey is last resort.
 * At most two active suggestions.
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
  const sattuAction = actions.find(isSattuFoodAction)
  const sattuLogged =
    (!!sattuAction && doneIds.has(sattuAction.id)) ||
    doneIds.has(SATTU_ACTION_ID) ||
    doneIds.has('sattu-extra')
  const bananaAction = actions.find(isBananaFoodAction)
  const bananaLogged = bananaAction ? doneIds.has(bananaAction.id) : false
  const nightDairy = actions.find(isNightDairyAction)
  const nightDairyDone = nightDairy ? doneIds.has(nightDairy.id) : true

  const proteinGap = Math.max(
    0,
    Math.round((protein.minimumTarget - protein.expectedDailyProtein) * 10) /
      10,
  )
  const carbGap = Math.max(0, protein.carbGap)
  const projectedProteinShort = proteinGap > 0
  const carbOrCalShort =
    carbGap > 30 ||
    protein.suggestCalorieTool ||
    protein.suggestShakeForCalories
  const late = protein.hour >= 19
  const out: ProteinChecklistSuggestion[] = []

  // Keep completed gap-fill rows visible for untick.
  if (eggsLogged) {
    const existing = completions.find(
      (c) => c.foodActionId === EGGS_ACTION_ID && c.completed,
    )
    const grams = existing?.estimatedProtein ?? 12
    out.push({
      kind: 'eggs',
      action: syntheticEggsAction(grams >= 17 ? 3 : grams >= 11 ? 2 : 1),
      hint: 'Logged today.',
      estimatedProteinG: grams,
      goal: 'logged',
    })
  }
  if (sattuLogged && sattuAction) {
    out.push({
      kind: 'sattu',
      action: sattuAction,
      hint: 'Logged today.',
      estimatedProteinG:
        settings?.sattuProteinPerServingG ??
        defaultProteinForActionName(sattuAction.name) ??
        12,
      estimatedCarbsG:
        settings?.sattuCarbsPerServingG ??
        defaultCarbsForActionName(sattuAction.name) ??
        22,
      goal: 'logged',
    })
  }
  if (bananaLogged && bananaAction) {
    out.push({
      kind: 'banana',
      action: bananaAction,
      hint: 'Logged today.',
      estimatedProteinG: defaultProteinForActionName(bananaAction.name) ?? 1,
      estimatedCarbsG: defaultCarbsForActionName(bananaAction.name) ?? 25,
      goal: 'logged',
    })
  }
  if (wheyLogged) {
    out.push({
      kind: 'whey',
      action: wheyFromPlan ?? syntheticWheyAction('Logged today.'),
      hint: 'Logged today.',
      estimatedProteinG:
        settings?.wheyProteinPerServingG ?? DEFAULT_WHEY_PROTEIN_G,
      goal: 'logged',
    })
  }

  if (!projectedProteinShort && !carbOrCalShort) {
    return dedupeSuggestions(out).slice(0, 2)
  }

  // Only count newly suggested (not already-logged) foods toward closing the gap.
  // Logged macros are already reflected in proteinGap / carbGap.
  let accountedProtein = 0
  let accountedCarbs = 0

  const pushFood = (s: ProteinChecklistSuggestion) => {
    if (out.some((x) => x.action.id === s.action.id || x.kind === s.kind)) {
      return false
    }
    const active = out.filter((x) => x.goal !== 'logged')
    const foodActive = active.filter((x) => x.kind !== 'whey')
    // Up to 2 food suggestions; whey may be a 3rd last-resort row.
    if (s.kind === 'whey') {
      if (active.length >= 3) return false
    } else if (foodActive.length >= 2) {
      return false
    }
    out.push(s)
    accountedProtein += s.estimatedProteinG
    accountedCarbs += s.estimatedCarbsG ?? 0
    return true
  }

  // 1) Protein food first — eggs
  if (projectedProteinShort && !eggsLogged) {
    const remainingP = proteinGap - accountedProtein
    if (remainingP > 0) {
      if (late && nightDairy && !nightDairyDone) {
        const dairyG =
          nightDairy.estimatedProteinG ?? proteinForSource('milk', 'normal')
        pushFood({
          kind: 'night_dairy',
          action: nightDairy,
          hint: `Suggested for protein — ~${dairyG}g from milk/curd before whey.`,
          estimatedProteinG: dairyG,
          estimatedCarbsG: defaultCarbsForActionName(nightDairy.name) ?? 12,
          goal: 'protein',
        })
      } else {
        const count = eggCountForGap(remainingP)
        const grams = proteinForSource(
          count === 1 ? 'eggs_1' : count === 2 ? 'eggs_2' : 'eggs_3',
        )
        pushFood({
          kind: 'eggs',
          action: syntheticEggsAction(count),
          hint: `Suggested for protein — ~${grams}g from eggs (before whey).`,
          estimatedProteinG: grams,
          goal: 'protein',
        })
      }
    }
  }

  // 2) Sattu — helps protein a bit + carbs/calories
  if (
    !sattuLogged &&
    sattuAction &&
    (projectedProteinShort || carbOrCalShort)
  ) {
    const sattuP =
      settings?.sattuProteinPerServingG ??
      defaultProteinForActionName(sattuAction.name) ??
      12
    const sattuC =
      settings?.sattuCarbsPerServingG ??
      defaultCarbsForActionName(sattuAction.name) ??
      22
    const stillNeedP = proteinGap - accountedProtein > 5
    const stillNeedC = carbGap - accountedCarbs > 20 || carbOrCalShort
    if (stillNeedP || stillNeedC) {
      const goal: ProteinChecklistSuggestion['goal'] = stillNeedP
        ? 'protein'
        : stillNeedC && carbGap > 20
          ? 'carbs'
          : 'calories'
      pushFood({
        kind: 'sattu',
        action: sattuAction,
        hint:
          goal === 'protein'
            ? `Suggested — sattu adds ~${sattuP}g protein + carbs before whey.`
            : goal === 'carbs'
              ? `Suggested for carbs — ~${sattuC}g from sattu.`
              : 'Suggested for calories — convenient food tool before whey.',
        estimatedProteinG: sattuP,
        estimatedCarbsG: sattuC,
        goal,
      })
    }
  }

  // 3) Banana — carbs / calories (not a protein fix)
  if (
    !bananaLogged &&
    bananaAction &&
    carbOrCalShort &&
    !projectedProteinShort
  ) {
    const carbs = defaultCarbsForActionName(bananaAction.name) ?? 25
    pushFood({
      kind: 'banana',
      action: bananaAction,
      hint: `Suggested for carbs/calories — ~${carbs}g carbs.`,
      estimatedProteinG: 1,
      estimatedCarbsG: carbs,
      goal: carbGap > 20 ? 'carbs' : 'calories',
    })
  }

  // If still carb/cal short and we only filled protein eggs, try banana as 2nd
  if (
    !bananaLogged &&
    bananaAction &&
    carbOrCalShort &&
    out.filter((s) => s.goal !== 'logged').length < 2
  ) {
    const already = out.some((s) => s.kind === 'banana')
    if (!already) {
      const carbs = defaultCarbsForActionName(bananaAction.name) ?? 25
      pushFood({
        kind: 'banana',
        action: bananaAction,
        hint: `Suggested for carbs/calories — ~${carbs}g carbs.`,
        estimatedProteinG: 1,
        estimatedCarbsG: carbs,
        goal: carbGap > 20 ? 'carbs' : 'calories',
      })
    }
  }

  // 4) Whey LAST RESORT — only if food cannot close a large protein gap
  const remainingProtein = proteinGap - accountedProtein
  const activeFood = out.filter(
    (s) => s.goal !== 'logged' && s.kind !== 'whey',
  )
  const triedEggsOrDairy =
    eggsLogged ||
    activeFood.some((s) => s.kind === 'eggs' || s.kind === 'night_dairy')
  const triedSattu =
    sattuLogged || !sattuAction || activeFood.some((s) => s.kind === 'sattu')
  const foodExhausted =
    activeFood.length >= 2 || (triedEggsOrDairy && triedSattu)

  const wantWheyLastResort =
    !!profile?.usesWhey &&
    !wheyLogged &&
    remainingProtein > 12 &&
    foodExhausted &&
    (late ||
      protein.status === 'SIGNIFICANTLY_SHORT' ||
      protein.hour >= 16)

  if (wantWheyLastResort) {
    const wheyG = settings?.wheyProteinPerServingG ?? DEFAULT_WHEY_PROTEIN_G
    pushFood({
      kind: 'whey',
      action:
        wheyFromPlan ??
        syntheticWheyAction(
          `Last resort — ~${Math.round(remainingProtein)}g protein still short after food options.`,
        ),
      hint: `Last resort — try food first; whey closes ~${wheyG}g if needed.`,
      estimatedProteinG: wheyG,
      goal: 'protein',
    })
  }

  // Keep logged rows + up to 2 food suggestions + optional whey last resort.
  const deduped = dedupeSuggestions(out)
  const logged = deduped.filter((s) => s.goal === 'logged')
  const active = deduped.filter((s) => s.goal !== 'logged')
  const foods = active.filter((s) => s.kind !== 'whey').slice(0, 2)
  const whey = active.find((s) => s.kind === 'whey')
  return [...logged, ...foods, ...(whey ? [whey] : [])]
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
