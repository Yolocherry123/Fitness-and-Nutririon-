/** Core classification & domain types — Technical Spec §6–14 */

export type ActionCategory = 'CORE' | 'SCHEDULED' | 'OPTIONAL' | 'SUBSTITUTE'
export type ExerciseSourceStatus = 'CONFIRMED' | 'RECONSTRUCTED' | 'CUSTOM'
export type WorkoutDayType = 'TRAINING' | 'ACTIVE_RECOVERY' | 'REST'
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'SKIPPED'
export type SetKind = 'WARMUP' | 'WORKING'
export type NutritionLogMode = 'EXACT' | 'APPROXIMATE' | 'CHECKLIST'
export type ChickenMeasureType = 'BONE_IN' | 'BREAST' | 'THIGH' | 'COOKED_EDIBLE'
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type CalorieRecommendation =
  | 'MAINTAIN'
  | 'INCREASE'
  | 'DECREASE'
  | 'COLLECT_MORE_DATA'
export type DigestionStatus = 'Good' | 'Neutral' | 'Poor'
export type SessionQuality =
  | 'Too easy'
  | 'Appropriate'
  | 'Hard but manageable'
  | 'Excessive fatigue'

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday'

export const DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export interface UserProfile {
  id: string
  age: number
  sex: 'Male' | 'Female' | 'Other'
  heightCm: number
  currentWeightKg: number
  goalWeightKg: number
  experience: string
  trainingPreference: string
  environment: string
  equipment: string
  wakeTime: string
  classStart: string
  classEnd: string
  milkPowderSubstitute: boolean
  usesCreatine: boolean
  usesWhey: boolean
  calorieTargetMin: number
  calorieTargetMax: number
  proteinTargetMin: number
  proteinTargetMax: number
  /** Soft carb range — editable; defaults derived if missing */
  carbTargetMin?: number
  carbTargetMax?: number
  waterGoalMl: number
  digestionMode: boolean
  onboardingComplete: boolean
  createdAt: string
  updatedAt: string
}

export interface BodyweightEntry {
  id: string
  date: string // YYYY-MM-DD
  weightKg: number
  conditionsNote?: string
  createdAt: string
}

export interface FoodAction {
  id: string
  name: string
  dayOfWeek: DayOfWeek | null // null = every day
  timeWindow: string
  category: ActionCategory
  quantity?: string
  unit?: string
  notes?: string
  sortOrder: number
  isTrainingDayOnly?: boolean
  isRestDayOnly?: boolean
  allowsMilkPowderSub?: boolean
  chickenMeasure?: ChickenMeasureType
  /** Default estimated protein when checklist-only (grams) */
  estimatedProteinG?: number
}

export interface DailyCompletion {
  id: string // `${date}:${foodActionId}`
  date: string
  foodActionId: string
  completed: boolean
  logMode: NutritionLogMode
  exactCalories?: number
  exactProtein?: number
  /** Estimated protein grams (approx / checklist defaults) */
  estimatedProtein?: number
  estimatedCalories?: number
  /** Breakdown lines for protein details UI */
  proteinBreakdown?: ProteinBreakdownLine[]
  /** Estimated carbs grams */
  estimatedCarbs?: number
  notes?: string
  chickenMeasure?: ChickenMeasureType
  actualQuantity?: string
  updatedAt: string
}

export interface ProteinBreakdownLine {
  label: string
  grams: number
  portion?: string
  source?: 'DEFAULT' | 'USER_CUSTOM' | 'PRODUCT_LABEL' | 'APPROXIMATION'
}

export type ProteinPortion = 'small' | 'normal' | 'large'

export type ShakeStyle =
  | 'whey_water'
  | 'whey_milk'
  | 'whey_milk_powder'
  | 'whey_banana'
  | 'custom'

export type ProteinRecoStatus =
  | 'ON_TRACK'
  | 'CLOSE'
  | 'LIKELY_SHORT'
  | 'SIGNIFICANTLY_SHORT'
  | 'EARLY_DAY'

export interface Exercise {
  id: string
  name: string
  sourceStatus: ExerciseSourceStatus
  movementPattern?: string
  notes?: string
  isSkill?: boolean
  isCoreCircuit?: boolean
  allowsVariationChoice?: boolean
  variationOptions?: string[]
}

export interface ExercisePrescription {
  id: string
  exerciseId: string
  workoutDayId: string
  order: number
  sets: number
  repMin: number
  repMax: number
  targetRIRMin: number
  targetRIRMax: number
  restSecondsSuggested: number
  perSide?: boolean
  notes?: string
}

export interface WorkoutDay {
  id: string
  day: DayOfWeek
  workoutName: string
  type: WorkoutDayType
  sourceNote?: string
}

export interface WorkoutPlan {
  id: string
  name: string
  version: number
  activeFrom: string
  archived: boolean
  reason?: string
  createdAt: string
}

export interface PlanVersion {
  id: string
  planId: string
  createdAt: string
  effectiveDate: string
  reason: string
  archived: boolean
  snapshotJson: string
}

export interface WorkoutSession {
  id: string
  date: string
  workoutDayId: string
  workoutPlanVersionId: string
  status: SessionStatus
  notes?: string
  sessionQuality?: SessionQuality
  primarySkill?: string
  secondarySkill?: string
  startedAt?: string
  completedAt?: string
}

export interface SetLog {
  id: string
  sessionId: string
  exerciseId: string
  setNumber: number
  kind: SetKind
  load?: number
  loadUnit?: 'kg' | 'bw' | 'assisted'
  variation?: string
  reps?: number
  rir?: number
  completed: boolean
  notes?: string
}

export interface ProgressionHistory {
  id: string
  exerciseId: string
  date: string
  recommendation: string
  reason: string
  previousLoad?: number
  suggestedLoad?: number
}

export interface WeeklyReview {
  id: string
  weekStart: string
  avgWeightKg?: number
  weightChangeKg?: number
  workoutsPlanned: number
  workoutsCompleted: number
  nutritionCorePct?: number
  creatinePct?: number
  sleepNotes?: string
  recommendation: CalorieRecommendation
  reason: string
  confidence: Confidence
  createdAt: string
}

export interface Recommendation {
  id: string
  date: string
  type: string
  primary: string
  secondary?: string
  optional?: string
  reason: string
  confidence: Confidence
  inputWindow?: string
  previousTarget?: string
  newTarget?: string
}

export interface Recipe {
  id: string
  name: string
  category: string
  ingredients: string[]
  quantities: string[]
  preparation: string
  substitutions: string[]
  storage: string
  nutritionNote?: string
}

export interface DailyCheckIn {
  id: string // date
  date: string
  energy?: number
  appetite?: number
  digestion?: DigestionStatus
  soreness?: number
  stress?: number
}

export interface AppSettings {
  id: string
  reminders: {
    bodyweight: boolean
    workout: boolean
    creatine: boolean
    weeklyReview: boolean
    mealPrep: boolean
  }
  lastWeeklyReviewWeek?: string
  /** Bump when seed content must be refreshed for existing installs */
  seedRevision?: number
  startingWeightKg?: number
  /** Product label — editable */
  wheyProteinPerServingG?: number
  wheyCaloriesPerServing?: number
  milkPowderProteinPerServingG?: number
  milkProteinPerGlassG?: number
}

export const CURRENT_SEED_REVISION = 3

export interface WaistEntry {
  id: string
  date: string
  cm: number
}

export const MILESTONES_KG = [65, 70, 75, 80, 85] as const
