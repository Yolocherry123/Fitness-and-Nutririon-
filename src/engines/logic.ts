import type {
  BodyweightEntry,
  CalorieRecommendation,
  Confidence,
  DailyCompletion,
  ExercisePrescription,
  FoodAction,
  SetLog,
  UserProfile,
} from '../models/types'
import { calendarWeeksSpanned } from '../lib/dates'

export interface CompletionScores {
  coreDone: number
  coreTotal: number
  scheduledDone: number
  scheduledTotal: number
  optionalDone: number
  optionalTotal: number
  corePct: number
  scheduledPct: number
  /** Overall consistency ignores optional */
  consistencyPct: number
}

export function scoreCompletions(
  actions: FoodAction[],
  completions: DailyCompletion[],
): CompletionScores {
  const map = new Map(completions.map((c) => [c.foodActionId, c]))
  let coreDone = 0
  let coreTotal = 0
  let scheduledDone = 0
  let scheduledTotal = 0
  let optionalDone = 0
  let optionalTotal = 0

  for (const a of actions) {
    const done = map.get(a.id)?.completed === true
    if (a.category === 'CORE') {
      coreTotal++
      if (done) coreDone++
    } else if (a.category === 'SCHEDULED') {
      scheduledTotal++
      if (done) scheduledDone++
    } else if (a.category === 'OPTIONAL') {
      optionalTotal++
      if (done) optionalDone++
    }
  }

  const corePct = coreTotal ? Math.round((coreDone / coreTotal) * 100) : 100
  const scheduledPct = scheduledTotal
    ? Math.round((scheduledDone / scheduledTotal) * 100)
    : 100
  const denom = coreTotal + scheduledTotal
  const consistencyPct = denom
    ? Math.round(((coreDone + scheduledDone) / denom) * 100)
    : 100

  return {
    coreDone,
    coreTotal,
    scheduledDone,
    scheduledTotal,
    optionalDone,
    optionalTotal,
    corePct,
    scheduledPct,
    consistencyPct,
  }
}

export type ProgressionAdvice =
  | { action: 'maintain'; reason: string }
  | { action: 'more_reps'; reason: string }
  | { action: 'increase_load'; reason: string }
  | { action: 'review_fatigue'; reason: string }

/** Double progression — session-level, not per-set. Requires RIR for load increases. */
export function recommendProgression(
  rx: ExercisePrescription,
  workingSets: SetLog[],
): ProgressionAdvice {
  const completed = workingSets.filter((s) => s.completed && s.reps != null)
  if (completed.length < rx.sets) {
    return {
      action: 'maintain',
      reason: 'Complete all working sets before changing load.',
    }
  }

  const missingRir = completed.some((s) => s.rir == null)
  if (missingRir) {
    return {
      action: 'maintain',
      reason:
        'Log RIR on working sets before increasing load. Hold the current difficulty and collect RIR next session.',
    }
  }

  const allAtTop = completed.every((s) => (s.reps ?? 0) >= rx.repMax)
  const rirOk = completed.every((s) => (s.rir as number) >= rx.targetRIRMin - 0.5)
  const avgRir =
    completed.reduce((sum, s) => sum + (s.rir as number), 0) / completed.length

  // Hitting failure (RIR 0) — including at the top of the range — is not a cue to push more reps
  if (avgRir <= 0) {
    return {
      action: 'review_fatigue',
      reason: allAtTop
        ? 'You reached the top of the rep range at failure (RIR 0). Hold load, prioritize form and recovery, and keep target RIR next session.'
        : 'Sets reached failure (RIR 0) before the top of the rep range. Consider holding load and improving quality.',
    }
  }

  if (allAtTop && rirOk) {
    return {
      action: 'increase_load',
      reason: `Hit the top of the ${rx.repMin}–${rx.repMax} range across working sets at target RIR. Increase load/difficulty next session, then restart nearer the low end of the range.`,
    }
  }

  const nearTop = completed.every((s) => (s.reps ?? 0) >= rx.repMin)
  if (nearTop) {
    return {
      action: 'more_reps',
      reason: `Stay at current load and push reps toward ${rx.repMax} while keeping form and target RIR (${rx.targetRIRMin}–${rx.targetRIRMax}).`,
    }
  }

  return {
    action: 'maintain',
    reason: 'Build consistency in the prescribed rep range before increasing difficulty.',
  }
}

export interface CalorieAdvice {
  recommendation: CalorieRecommendation
  reason: string
  confidence: Confidence
  weeklyRateKg?: number
  weeksOfData: number
}

/**
 * Calorie adjustment requires sufficient trend data, adherence, and meaningful change.
 * Does not react to a single weigh-in.
 */
export function recommendCalorieAdjustment(input: {
  entries: BodyweightEntry[]
  adherencePct: number
  /** If omitted, computed from entry date span */
  weeksOfData?: number
  targetGainKgPerWeek?: number
}): CalorieAdvice {
  const { entries, adherencePct } = input
  const targetGain = input.targetGainKgPerWeek ?? 0.25
  const weeksOfData = input.weeksOfData ?? calendarWeeksSpanned(entries)

  if (entries.length < 5 || weeksOfData < 2) {
    return {
      recommendation: 'COLLECT_MORE_DATA',
      reason:
        'Not enough consistent weigh-ins yet. Keep logging under similar morning conditions and review again after more data.',
      confidence: 'LOW',
      weeksOfData,
    }
  }

  if (adherencePct < 60) {
    return {
      recommendation: 'COLLECT_MORE_DATA',
      reason:
        'Adherence was relatively low this period. Improve consistency and collect another week of data before changing the calorie target.',
      confidence: 'MEDIUM',
      weeksOfData,
    }
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const mid = Math.floor(sorted.length / 2)
  const first = sorted.slice(0, mid)
  const second = sorted.slice(mid)
  const avg = (arr: BodyweightEntry[]) =>
    arr.reduce((s, e) => s + e.weightKg, 0) / arr.length

  // Span between first/last of each half (not midpoint-of-count), floored at 1 week
  const firstStart = first[0]?.date ?? sorted[0].date
  const firstEnd = first[first.length - 1]?.date ?? sorted[0].date
  const secondStart = second[0]?.date ?? sorted[sorted.length - 1].date
  const secondEnd = second[second.length - 1]?.date ?? sorted[sorted.length - 1].date
  const halfA = Math.max(
    calendarWeeksSpanned([
      { id: 'a', date: firstStart, weightKg: 0, createdAt: '' },
      { id: 'b', date: firstEnd, weightKg: 0, createdAt: '' },
    ]),
    0.5,
  )
  const halfB = Math.max(
    calendarWeeksSpanned([
      { id: 'a', date: secondStart, weightKg: 0, createdAt: '' },
      { id: 'b', date: secondEnd, weightKg: 0, createdAt: '' },
    ]),
    0.5,
  )
  // Approximate weeks between half centers ≈ (halfA + halfB) / 2, min 1 week for rate
  const halfSpanWeeks = Math.max((halfA + halfB) / 2, 1)

  const change = avg(second) - avg(first)
  const weeklyRate = change / halfSpanWeeks

  if (weeksOfData < 3) {
    return {
      recommendation: 'MAINTAIN',
      reason: `Early trend (~${weeklyRate.toFixed(2)} kg/week estimated over ~${weeksOfData.toFixed(1)} weeks). Continue the current plan and reassess after another week of consistent data.`,
      confidence: 'MEDIUM',
      weeklyRateKg: weeklyRate,
      weeksOfData,
    }
  }

  if (weeklyRate < targetGain * 0.4 && adherencePct >= 70) {
    return {
      recommendation: 'INCREASE',
      reason:
        'Your recent average bodyweight has remained relatively flat despite reasonably consistent adherence, so a small calorie increase of approximately 100–150 kcal/day may be appropriate.',
      confidence: weeksOfData >= 4 ? 'HIGH' : 'MEDIUM',
      weeklyRateKg: weeklyRate,
      weeksOfData,
    }
  }

  if (weeklyRate > targetGain * 2.2 && adherencePct >= 70) {
    return {
      recommendation: 'DECREASE',
      reason:
        'Bodyweight has been rising faster than a controlled surplus typically needs. A small reduction of approximately 100–150 kcal/day may help limit unnecessary fat gain.',
      confidence: weeksOfData >= 4 ? 'HIGH' : 'MEDIUM',
      weeklyRateKg: weeklyRate,
      weeksOfData,
    }
  }

  return {
    recommendation: 'MAINTAIN',
    reason:
      'Average bodyweight trend looks appropriate for gradual muscle-focused gain. Continue the current calorie target.',
    confidence: 'HIGH',
    weeklyRateKg: weeklyRate,
    weeksOfData,
  }
}

export function averageWeight(entries: BodyweightEntry[]): number | null {
  if (!entries.length) return null
  return entries.reduce((s, e) => s + e.weightKg, 0) / entries.length
}

export function creatineMissMessage(): string {
  return 'Resume your normal 3–5 g dose. Do not double up to compensate.'
}

export function suggestCalorieGapTool(): string {
  return 'Try ONE practical addition first: banana, sattu drink, peanut butter, milk/milk powder, PB sandwich, oats, nuts, or a small amount of ghee.'
}

export function suggestProteinGapPriority(): string[] {
  return [
    'Use protein in upcoming normal meals',
    'Use scheduled chicken/kebab if today has one',
    'Use convenient foods (eggs, curd, milk, paneer)',
    'Use whey when convenience is the main advantage',
  ]
}

/** Filter food actions by profile supplement preferences. */
export function applyProfileFoodFilters(
  actions: FoodAction[],
  profile?: Pick<UserProfile, 'usesCreatine' | 'usesWhey'> | null,
): FoodAction[] {
  if (!profile) return actions
  return actions.filter((a) => {
    if (/creatine/i.test(a.name) && !profile.usesCreatine) return false
    if (/^whey\b/i.test(a.name) && !profile.usesWhey) return false
    return true
  })
}

export function isChickenOrKebabAction(action: FoodAction): boolean {
  return /chicken|kebab/i.test(action.name)
}

export function isCreatineAction(action: FoodAction): boolean {
  return /creatine/i.test(action.name)
}

export function isWheyAction(action: Pick<FoodAction, 'name' | 'id'>): boolean {
  return action.id === 'shake-extra' || /\bwhey\b/i.test(action.name)
}
