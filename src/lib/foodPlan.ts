import { db, uid } from '../db'
import type { ActionCategory, DayOfWeek, FoodAction } from '../models/types'
import { TIME_WINDOWS } from '../lib/food'

export type FoodActionInput = {
  name: string
  dayOfWeek: DayOfWeek | null
  timeWindow: (typeof TIME_WINDOWS)[number] | string
  category: ActionCategory
  quantity?: string
  unit?: string
  notes?: string
  sortOrder?: number
  allowsMilkPowderSub?: boolean
}

const WINDOW_ORDER: Record<string, number> = {
  Morning: 10,
  Breakfast: 20,
  Lunch: 40,
  Afternoon: 50,
  Supplements: 60,
  Dinner: 70,
  Night: 90,
}

export function defaultSortForWindow(timeWindow: string): number {
  return WINDOW_ORDER[timeWindow] ?? 50
}

export async function saveFoodAction(
  action: FoodAction,
): Promise<void> {
  await db.foodActions.put(action)
}

export async function addFoodAction(input: FoodActionInput): Promise<string> {
  const id = uid('food')
  const action: FoodAction = {
    id,
    name: input.name.trim(),
    dayOfWeek: input.dayOfWeek,
    timeWindow: input.timeWindow,
    category: input.category,
    quantity: input.quantity?.trim() || undefined,
    unit: input.unit?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    sortOrder: input.sortOrder ?? defaultSortForWindow(input.timeWindow),
    allowsMilkPowderSub: input.allowsMilkPowderSub,
  }
  await db.foodActions.put(action)
  return id
}

export async function deleteFoodAction(id: string): Promise<void> {
  await db.foodActions.delete(id)
  // Clean orphaned completions for this action (optional but tidy)
  const orphans = await db.completions.where('foodActionId').equals(id).toArray()
  if (orphans.length) {
    await db.completions.bulkDelete(orphans.map((c) => c.id))
  }
}
