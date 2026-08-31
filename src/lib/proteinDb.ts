import type { ChickenMeasureType, ProteinPortion } from '../models/types'

/** Configurable approximate protein database (hostel-friendly). */

export type ProteinSourceId =
  | 'dal'
  | 'rajma'
  | 'chana'
  | 'paneer'
  | 'soy'
  | 'eggs_1'
  | 'eggs_2'
  | 'eggs_3'
  | 'chicken'
  | 'curd'
  | 'milk'
  | 'other'

export const HOSTEL_PROTEIN_SOURCES: {
  id: ProteinSourceId
  label: string
  fixedG?: number
  fixedCarbsG?: number
  byPortion?: Record<ProteinPortion, number>
  carbsByPortion?: Record<ProteinPortion, number>
}[] = [
  {
    id: 'dal',
    label: 'Dal',
    byPortion: { small: 5, normal: 8, large: 12 },
    carbsByPortion: { small: 12, normal: 20, large: 28 },
  },
  {
    id: 'rajma',
    label: 'Rajma',
    byPortion: { small: 6, normal: 10, large: 14 },
    carbsByPortion: { small: 15, normal: 25, large: 35 },
  },
  {
    id: 'chana',
    label: 'Chana',
    byPortion: { small: 6, normal: 10, large: 14 },
    carbsByPortion: { small: 14, normal: 22, large: 30 },
  },
  {
    id: 'paneer',
    label: 'Paneer',
    byPortion: { small: 8, normal: 14, large: 20 },
    carbsByPortion: { small: 2, normal: 4, large: 6 },
  },
  {
    id: 'soy',
    label: 'Soy',
    byPortion: { small: 8, normal: 12, large: 18 },
    carbsByPortion: { small: 4, normal: 8, large: 12 },
  },
  { id: 'eggs_1', label: '1 egg', fixedG: 6, fixedCarbsG: 0 },
  { id: 'eggs_2', label: '2 eggs', fixedG: 12, fixedCarbsG: 0 },
  { id: 'eggs_3', label: '3 eggs', fixedG: 18, fixedCarbsG: 0 },
  {
    id: 'chicken',
    label: 'Chicken',
    byPortion: { small: 15, normal: 25, large: 35 },
    carbsByPortion: { small: 0, normal: 0, large: 0 },
  },
  {
    id: 'curd',
    label: 'Curd / yogurt',
    byPortion: { small: 4, normal: 7, large: 10 },
    carbsByPortion: { small: 4, normal: 6, large: 9 },
  },
  {
    id: 'milk',
    label: 'Milk / milk-powder drink',
    byPortion: { small: 4, normal: 8, large: 12 },
    carbsByPortion: { small: 6, normal: 12, large: 18 },
  },
  {
    id: 'other',
    label: 'Other protein',
    byPortion: { small: 5, normal: 10, large: 15 },
    carbsByPortion: { small: 5, normal: 10, large: 15 },
  },
]

export function proteinForSource(
  id: ProteinSourceId,
  portion: ProteinPortion = 'normal',
): number {
  const row = HOSTEL_PROTEIN_SOURCES.find((s) => s.id === id)
  if (!row) return 0
  if (row.fixedG != null) return row.fixedG
  return row.byPortion?.[portion] ?? 0
}

export function carbsForSource(
  id: ProteinSourceId,
  portion: ProteinPortion = 'normal',
): number {
  const row = HOSTEL_PROTEIN_SOURCES.find((s) => s.id === id)
  if (!row) return 0
  if (row.fixedCarbsG != null) return row.fixedCarbsG
  return row.carbsByPortion?.[portion] ?? 0
}

/** Rough edible-meat protein from chicken logging modes (approximate). */
export function chickenProteinEstimate(
  measure: ChickenMeasureType,
  quantityHint?: string,
): number {
  const n = quantityHint ? parseFloat(quantityHint) : NaN
  if (measure === 'BONE_IN') {
    // Bone-in weight ≠ edible meat — conservative edible estimate
    if (Number.isFinite(n) && n > 50) return Math.round((n * 0.45 * 0.25) / 1) // ~25% of edible portion
    return 28
  }
  if (measure === 'COOKED_EDIBLE' || measure === 'BREAST' || measure === 'THIGH') {
    if (Number.isFinite(n) && n > 30) return Math.round(n * 0.27)
    return measure === 'BREAST' ? 32 : 28
  }
  return 25
}

/** Default checklist estimates when no detail modal was used. */
export const DEFAULT_FOOD_PROTEIN: Record<string, number> = {
  'anabolic bowl': 28,
  'hostel breakfast': 12,
  'hostel lunch': 15,
  'hostel dinner': 18,
  'pre-workout banana': 1,
  'night milk': 8,
  'night food': 10,
  banana: 1,
  creatine: 0,
  water: 0,
}

export const DEFAULT_FOOD_CARBS: Record<string, number> = {
  'anabolic bowl': 55,
  'hostel breakfast': 45,
  'hostel lunch': 70,
  'hostel dinner': 65,
  'pre-workout banana': 25,
  'night milk': 12,
  'night food': 35,
  banana: 25,
  creatine: 0,
  water: 0,
}

export function defaultProteinForActionName(name: string): number | undefined {
  const key = name.toLowerCase()
  for (const [k, v] of Object.entries(DEFAULT_FOOD_PROTEIN)) {
    if (key.includes(k)) return v
  }
  if (/chicken|kebab/i.test(name)) return 28
  if (/whey/i.test(name)) return 24
  return undefined
}

export function defaultCarbsForActionName(name: string): number | undefined {
  const key = name.toLowerCase()
  for (const [k, v] of Object.entries(DEFAULT_FOOD_CARBS)) {
    if (key.includes(k)) return v
  }
  if (/chicken|kebab/i.test(name)) return 0
  if (/whey/i.test(name)) return 3
  return undefined
}

export const DEFAULT_WHEY_PROTEIN_G = 24
export const DEFAULT_WHEY_CALORIES = 120
export const DEFAULT_MILK_POWDER_PROTEIN_G = 8
export const DEFAULT_MILK_GLASS_PROTEIN_G = 8
