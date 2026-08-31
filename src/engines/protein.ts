import type {
  AppSettings,
  DailyCompletion,
  FoodAction,
  ProteinRecoStatus,
  UserProfile,
} from '../models/types'
import {
  chickenProteinEstimate,
  defaultCarbsForActionName,
  defaultProteinForActionName,
  DEFAULT_WHEY_PROTEIN_G,
} from '../lib/proteinDb'
import { isChickenOrKebabAction } from './logic'

export interface ProteinLine {
  foodActionId: string
  name: string
  grams: number
  status: 'CONSUMED' | 'EXPECTED'
  logMode?: string
  approximate: boolean
}

export interface ProteinSummary {
  consumedProtein: number
  expectedRemainingProtein: number
  expectedDailyProtein: number
  targetProtein: number
  minimumTarget: number
  maximumTarget: number
  proteinGap: number
  consumedCarbs: number
  expectedRemainingCarbs: number
  expectedDailyCarbs: number
  carbTarget: number
  carbMinimum: number
  carbMaximum: number
  carbGap: number
  status: ProteinRecoStatus
  primaryMessage: string
  secondaryMessage?: string
  suggestShakeForProtein: boolean
  suggestShakeForCalories: boolean
  foodFirst: boolean
  hour: number
  consumedLines: ProteinLine[]
  expectedLines: ProteinLine[]
}

function proteinFromCompletion(
  action: FoodAction,
  c: DailyCompletion | undefined,
  settings?: AppSettings | null,
): number {
  if (!c?.completed) return 0
  if (c.exactProtein != null && Number.isFinite(c.exactProtein)) return c.exactProtein
  if (c.estimatedProtein != null && Number.isFinite(c.estimatedProtein)) {
    return c.estimatedProtein
  }
  if (c.proteinBreakdown?.length) {
    return c.proteinBreakdown.reduce((s, l) => s + l.grams, 0)
  }
  if (isChickenOrKebabAction(action) && c.chickenMeasure) {
    return chickenProteinEstimate(c.chickenMeasure, c.actualQuantity)
  }
  if (/whey/i.test(action.name)) {
    return settings?.wheyProteinPerServingG ?? DEFAULT_WHEY_PROTEIN_G
  }
  if (action.estimatedProteinG != null) return action.estimatedProteinG
  return defaultProteinForActionName(action.name) ?? 0
}

function expectedProteinForAction(
  action: FoodAction,
  settings?: AppSettings | null,
): number {
  if (action.category === 'OPTIONAL' && !isChickenOrKebabAction(action)) {
    // Don't bank on optional whey/snacks for expected remaining
    if (/whey|shake/i.test(action.name)) return 0
  }
  if (isChickenOrKebabAction(action)) {
    return chickenProteinEstimate(
      action.chickenMeasure ?? (/kebab/i.test(action.name) ? 'COOKED_EDIBLE' : 'BONE_IN'),
      action.quantity,
    )
  }
  if (action.estimatedProteinG != null) return action.estimatedProteinG
  return defaultProteinForActionName(action.name) ?? 0
}

function hasReasonableConfidence(action: FoodAction): boolean {
  if (isChickenOrKebabAction(action)) return true
  if (action.category === 'CORE' || action.category === 'SCHEDULED') {
    return /hostel|anabolic|dinner|lunch|breakfast|milk|chicken|kebab|bowl/i.test(
      action.name,
    )
  }
  return false
}

function carbsFromCompletion(
  action: FoodAction,
  c: DailyCompletion | undefined,
): number {
  if (!c?.completed) return 0
  if (c.estimatedCarbs != null && Number.isFinite(c.estimatedCarbs)) {
    return c.estimatedCarbs
  }
  if (isChickenOrKebabAction(action)) return 0
  if (/whey/i.test(action.name)) return 3
  return defaultCarbsForActionName(action.name) ?? 0
}

function expectedCarbsForAction(action: FoodAction): number {
  if (action.category === 'OPTIONAL' && /whey|shake/i.test(action.name)) return 0
  if (isChickenOrKebabAction(action)) return 0
  return defaultCarbsForActionName(action.name) ?? 0
}

export function buildProteinSummary(input: {
  actions: FoodAction[]
  completions: DailyCompletion[]
  profile?: Pick<
    UserProfile,
    | 'proteinTargetMin'
    | 'proteinTargetMax'
    | 'carbTargetMin'
    | 'carbTargetMax'
    | 'calorieTargetMin'
    | 'calorieTargetMax'
    | 'usesWhey'
  > | null
  settings?: AppSettings | null
  hour?: number
  /** Soft calorie-gap signal from elsewhere — does not force protein shake */
  caloriesMayHelp?: boolean
}): ProteinSummary {
  const hour = input.hour ?? new Date().getHours()
  const minT = input.profile?.proteinTargetMin ?? 110
  const maxT = input.profile?.proteinTargetMax ?? 125
  const target = Math.round((minT + maxT) / 2)

  const avgCal =
    ((input.profile?.calorieTargetMin ?? 2900) +
      (input.profile?.calorieTargetMax ?? 3100)) /
    2
  const carbMin =
    input.profile?.carbTargetMin ?? Math.round((avgCal * 0.42) / 4)
  const carbMax =
    input.profile?.carbTargetMax ?? Math.round((avgCal * 0.52) / 4)
  const carbTarget = Math.round((carbMin + carbMax) / 2)

  const doneMap = new Map(input.completions.map((c) => [c.foodActionId, c]))
  const consumedLines: ProteinLine[] = []
  const expectedLines: ProteinLine[] = []
  let consumedCarbs = 0
  let expectedRemainingCarbs = 0

  for (const a of input.actions) {
    const c = doneMap.get(a.id)
    if (c?.completed) {
      const grams = proteinFromCompletion(a, c, input.settings)
      consumedCarbs += carbsFromCompletion(a, c)
      if (grams > 0 || /whey|shake|chicken|egg|dal|bowl|hostel|banana/i.test(a.name)) {
        consumedLines.push({
          foodActionId: a.id,
          name: a.name,
          grams,
          status: 'CONSUMED',
          logMode: c.logMode,
          approximate: c.logMode !== 'EXACT',
        })
      }
    } else if (hasReasonableConfidence(a)) {
      const grams = expectedProteinForAction(a, input.settings)
      expectedRemainingCarbs += expectedCarbsForAction(a)
      if (grams > 0 || expectedCarbsForAction(a) > 0) {
        expectedLines.push({
          foodActionId: a.id,
          name: a.name,
          grams,
          status: 'EXPECTED',
          approximate: true,
        })
      }
    }
  }

  // Shake / ad-hoc protein logs not tied to a plan row
  for (const c of input.completions) {
    if (!c.completed) continue
    if (consumedLines.some((l) => l.foodActionId === c.foodActionId)) continue
    const grams =
      c.exactProtein ??
      c.estimatedProtein ??
      c.proteinBreakdown?.reduce((s, l) => s + l.grams, 0) ??
      0
    if (grams <= 0 && !(c.estimatedCarbs && c.estimatedCarbs > 0)) continue
    consumedCarbs += c.estimatedCarbs ?? 0
    if (grams > 0) {
      consumedLines.push({
        foodActionId: c.foodActionId,
        name: c.notes?.replace(/^Shake · /, '') || 'Protein shake',
        grams,
        status: 'CONSUMED',
        logMode: c.logMode,
        approximate: c.logMode !== 'EXACT',
      })
    }
  }

  const consumedProtein = round1(
    consumedLines.reduce((s, l) => s + l.grams, 0),
  )
  const expectedRemainingProtein = round1(
    expectedLines.reduce((s, l) => s + l.grams, 0),
  )
  const expectedDailyProtein = round1(consumedProtein + expectedRemainingProtein)
  const proteinGap = round1(target - expectedDailyProtein)
  consumedCarbs = round1(consumedCarbs)
  expectedRemainingCarbs = round1(expectedRemainingCarbs)
  const expectedDailyCarbs = round1(consumedCarbs + expectedRemainingCarbs)
  const carbGap = round1(carbTarget - expectedDailyCarbs)

  const mealsRemain = expectedLines.some((l) =>
    /lunch|dinner|hostel|chicken|kebab|breakfast/i.test(l.name),
  )
  const early = hour < 12
  const late = hour >= 18

  let status: ProteinRecoStatus
  let primaryMessage: string
  let secondaryMessage: string | undefined
  let suggestShakeForProtein = false
  let foodFirst = false

  if (early && expectedDailyProtein < minT) {
    status = 'EARLY_DAY'
    primaryMessage = 'Early day — focus on planned meals first.'
    secondaryMessage = 'Don’t stack shakes just because protein looks low this morning.'
    foodFirst = true
  } else if (expectedDailyProtein >= minT) {
    status = 'ON_TRACK'
    primaryMessage = 'Protein looks on track — shake probably unnecessary.'
    secondaryMessage = input.caloriesMayHelp
      ? 'Protein OK; a shake could still help calories.'
      : undefined
  } else if (proteinGap <= 15 || expectedDailyProtein >= 95) {
    status = 'CLOSE'
    primaryMessage = mealsRemain
      ? 'Close on protein — check remaining meals before whey.'
      : 'Close on protein — small addition optional.'
    foodFirst = mealsRemain
    suggestShakeForProtein = !mealsRemain && !!input.profile?.usesWhey
  } else if (expectedDailyProtein >= 80) {
    status = 'LIKELY_SHORT'
    primaryMessage = mealsRemain
      ? 'Likely short on protein — prioritize dinner protein first.'
      : 'Likely short on protein — convenient source useful.'
    foodFirst = mealsRemain
    suggestShakeForProtein = !!input.profile?.usesWhey
  } else {
    status = late || !mealsRemain ? 'SIGNIFICANTLY_SHORT' : 'LIKELY_SHORT'
    primaryMessage =
      status === 'SIGNIFICANTLY_SHORT'
        ? 'Well below protein target — add one convenient source (not multiple shakes).'
        : 'Well below protein — prioritize remaining meals.'
    foodFirst = mealsRemain && !late
    suggestShakeForProtein = !!input.profile?.usesWhey && (late || !mealsRemain)
  }

  return {
    consumedProtein,
    expectedRemainingProtein,
    expectedDailyProtein,
    targetProtein: target,
    minimumTarget: minT,
    maximumTarget: maxT,
    proteinGap,
    consumedCarbs,
    expectedRemainingCarbs,
    expectedDailyCarbs,
    carbTarget,
    carbMinimum: carbMin,
    carbMaximum: carbMax,
    carbGap,
    status,
    primaryMessage,
    secondaryMessage,
    suggestShakeForProtein,
    suggestShakeForCalories: !!input.caloriesMayHelp && status === 'ON_TRACK',
    foodFirst,
    hour,
    consumedLines,
    expectedLines,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function statusLabel(s: ProteinRecoStatus): string {
  switch (s) {
    case 'ON_TRACK':
      return 'On track'
    case 'CLOSE':
      return 'Close'
    case 'LIKELY_SHORT':
      return 'Likely short'
    case 'SIGNIFICANTLY_SHORT':
      return 'Significantly short'
    case 'EARLY_DAY':
      return 'Early day'
  }
}

export function statusTone(s: ProteinRecoStatus): 'green' | 'yellow' | 'orange' | 'red' | 'info' {
  switch (s) {
    case 'ON_TRACK':
      return 'green'
    case 'CLOSE':
    case 'EARLY_DAY':
      return 'yellow'
    case 'LIKELY_SHORT':
      return 'orange'
    case 'SIGNIFICANTLY_SHORT':
      return 'red'
  }
}
