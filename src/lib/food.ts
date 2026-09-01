import type { DayOfWeek, DailyCompletion, FoodAction, UserProfile } from '../models/types'
import { dayOfWeekFromDate } from '../lib/dates'
import { applyProfileFoodFilters } from '../engines/logic'

export function foodActionsForDay(
  all: FoodAction[],
  day: DayOfWeek,
  options?: {
    digestionMode?: boolean
    profile?: Pick<UserProfile, 'usesCreatine' | 'usesWhey' | 'digestionMode'> | null
  },
): FoodAction[] {
  let list = all.filter((a) => a.dayOfWeek === null || a.dayOfWeek === day)

  const digestion = options?.digestionMode ?? options?.profile?.digestionMode
  if (digestion) {
    list = list.filter(
      (a) =>
        !(
          a.category === 'OPTIONAL' &&
          /\b(chia|flax|sprouts|nuts|sattu)\b/i.test(a.name)
        ),
    )
  }

  list = applyProfileFoodFilters(list, options?.profile)

  return list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export function foodActionsForDate(
  all: FoodAction[],
  dateISO: string,
  options?: {
    digestionMode?: boolean
    profile?: Pick<UserProfile, 'usesCreatine' | 'usesWhey' | 'digestionMode'> | null
  },
): FoodAction[] {
  return foodActionsForDay(all, dayOfWeekFromDate(dateISO), options)
}

export const TIME_WINDOWS = [
  'Morning',
  'Breakfast',
  'Lunch',
  'Afternoon',
  'Supplements',
  'Dinner',
  'Night',
] as const

export function groupByTimeWindow(actions: FoodAction[]) {
  const groups: { window: string; items: FoodAction[] }[] = TIME_WINDOWS.map(
    (window) => ({
      window,
      items: actions.filter((a) => a.timeWindow === window),
    }),
  )
  return groups.filter((g) => g.items.length > 0)
}

export const WINDOW_LABELS: Record<string, string> = {
  Morning: 'Morning',
  Breakfast: 'Breakfast',
  Lunch: 'Lunch',
  Afternoon: 'Before workout (afternoon)',
  Supplements: 'Supplements',
  Dinner: 'Dinner',
  Night: 'Night food',
}

const HIGH_FIBER_OPTIONAL_RE = /\b(chia|flax|sprouts|nuts|oats)\b/i

/** True if user completed optional high-fiber items today (for stacking warnings). */
export function highFiberOptionalsDoneToday(
  actions: FoodAction[],
  completions: DailyCompletion[],
): boolean {
  const done = new Set(
    completions.filter((c) => c.completed).map((c) => c.foodActionId),
  )
  return actions.some(
    (a) =>
      a.category === 'OPTIONAL' &&
      HIGH_FIBER_OPTIONAL_RE.test(a.name) &&
      done.has(a.id),
  )
}
