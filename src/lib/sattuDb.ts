import type {
  AppSettings,
  NutritionSource,
  ProteinBreakdownLine,
  SattuLiquidType,
  SattuRecipeType,
} from '../models/types'
import {
  DEFAULT_MILK_GLASS_PROTEIN_G,
  DEFAULT_MILK_POWDER_PROTEIN_G,
} from './proteinDb'

/** Approximate defaults for ~40 g sattu — clearly labeled, not brand-specific */
export const DEFAULT_SATTU_SERVING_G = 40
export const DEFAULT_SATTU_CALORIES = 150
export const DEFAULT_SATTU_PROTEIN_G = 12
export const DEFAULT_SATTU_CARBS_G = 22
export const DEFAULT_SATTU_FAT_G = 3

const BANANA_CALORIES = 90
const BANANA_CARBS_G = 27
const BANANA_PROTEIN_G = 1
const MILK_GLASS_CALORIES = 120
const MILK_GLASS_CARBS_G = 12
const MILK_POWDER_DRINK_CALORIES = 100
const MILK_POWDER_DRINK_CARBS_G = 10

export const SATTU_RECIPE_LABELS: Record<SattuRecipeType, string> = {
  basic: 'Basic Sattu Drink',
  sweet: 'Sweet Sattu Shake',
  savory: 'Savory Sattu Drink',
  custom: 'Custom Sattu',
}

function sattuBaseFromSettings(settings?: AppSettings | null): {
  servingG: number
  calories: number
  protein: number
  carbs: number
  fat: number
  source: NutritionSource
  brand: string
} {
  const servingG = settings?.sattuServingSizeG ?? DEFAULT_SATTU_SERVING_G
  const hasLabel =
    settings?.sattuNutritionSource === 'PRODUCT_LABEL' ||
    settings?.sattuNutritionSource === 'USER_CUSTOM' ||
    (settings?.sattuCaloriesPerServing != null &&
      settings?.sattuProteinPerServingG != null)
  return {
    servingG,
    calories: settings?.sattuCaloriesPerServing ?? DEFAULT_SATTU_CALORIES,
    protein: settings?.sattuProteinPerServingG ?? DEFAULT_SATTU_PROTEIN_G,
    carbs: settings?.sattuCarbsPerServingG ?? DEFAULT_SATTU_CARBS_G,
    fat: settings?.sattuFatPerServingG ?? DEFAULT_SATTU_FAT_G,
    source: hasLabel
      ? (settings?.sattuNutritionSource ?? 'PRODUCT_LABEL')
      : 'DEFAULT_ESTIMATE',
    brand: settings?.sattuBrandName ?? 'Sattu (approx.)',
  }
}

function scale(value: number, amountG: number, servingG: number): number {
  if (servingG <= 0) return 0
  return Math.round(value * (amountG / servingG) * 10) / 10
}

export function estimateSattuNutrition(input: {
  recipeType: SattuRecipeType
  amountG: number
  liquid?: SattuLiquidType
  addBanana?: boolean
  customProtein?: number
  customCalories?: number
  settings?: AppSettings | null
}): {
  protein: number
  carbs: number
  calories: number
  breakdown: ProteinBreakdownLine[]
  source: NutritionSource
} {
  const amountG = Math.max(0, input.amountG || DEFAULT_SATTU_SERVING_G)
  const base = sattuBaseFromSettings(input.settings)
  const breakdown: ProteinBreakdownLine[] = []

  if (input.recipeType === 'custom') {
    const protein = input.customProtein ?? 0
    const calories = input.customCalories
    breakdown.push({
      label: 'Custom sattu drink',
      grams: protein,
      source: 'USER_CUSTOM',
    })
    return {
      protein,
      carbs: 0,
      calories: calories ?? 0,
      breakdown,
      source: 'USER_CUSTOM',
    }
  }

  let protein = scale(base.protein, amountG, base.servingG)
  let carbs = scale(base.carbs, amountG, base.servingG)
  let calories = scale(base.calories, amountG, base.servingG)

  breakdown.push({
    label: `${base.brand} (${amountG} g)`,
    grams: protein,
    source: base.source === 'DEFAULT_ESTIMATE' ? 'APPROXIMATION' : 'PRODUCT_LABEL',
  })

  const liquid = input.liquid ?? 'water'
  if (input.recipeType === 'sweet' && liquid === 'milk') {
    const milkP = input.settings?.milkProteinPerGlassG ?? DEFAULT_MILK_GLASS_PROTEIN_G
    protein += milkP
    carbs += MILK_GLASS_CARBS_G
    calories += MILK_GLASS_CALORIES
    breakdown.push({
      label: 'Milk',
      grams: milkP,
      source: 'APPROXIMATION',
    })
  } else if (input.recipeType === 'sweet' && liquid === 'milk_powder') {
    const mpP =
      input.settings?.milkPowderProteinPerServingG ?? DEFAULT_MILK_POWDER_PROTEIN_G
    protein += mpP
    carbs += MILK_POWDER_DRINK_CARBS_G
    calories += MILK_POWDER_DRINK_CALORIES
    breakdown.push({
      label: 'Milk-powder drink',
      grams: mpP,
      source: 'APPROXIMATION',
    })
  }

  if (input.recipeType === 'sweet' && input.addBanana) {
    protein += BANANA_PROTEIN_G
    carbs += BANANA_CARBS_G
    calories += BANANA_CALORIES
    breakdown.push({
      label: 'Banana',
      grams: BANANA_PROTEIN_G,
      source: 'APPROXIMATION',
    })
  }

  return {
    protein: round1(protein),
    carbs: round1(carbs),
    calories: round1(calories),
    breakdown,
    source: base.source,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function isSattuCompletion(notes?: string, foodActionId?: string): boolean {
  if (foodActionId === 'sattu-extra' || foodActionId === 'food-sattu-optional') {
    return true
  }
  return /^Sattu ·/i.test(notes ?? '')
}
