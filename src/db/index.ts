import Dexie, { type Table } from 'dexie'
import type {
  AppSettings,
  BodyweightEntry,
  DailyCheckIn,
  DailyCompletion,
  Exercise,
  ExercisePrescription,
  FoodAction,
  PlanVersion,
  ProgressionHistory,
  Recommendation,
  Recipe,
  SetLog,
  UserProfile,
  WaistEntry,
  WeeklyReview,
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from '../models/types'
import { CURRENT_SEED_REVISION } from '../models/types'
import {
  DEFAULT_PROFILE,
  RECIPES,
  WORKOUT_DAYS,
  buildExercises,
  buildFoodActions,
  buildPrescriptions,
} from '../data/seed'

export class FitnessDB extends Dexie {
  profile!: Table<UserProfile, string>
  bodyweight!: Table<BodyweightEntry, string>
  foodActions!: Table<FoodAction, string>
  completions!: Table<DailyCompletion, string>
  workoutPlans!: Table<WorkoutPlan, string>
  workoutDays!: Table<WorkoutDay, string>
  exercises!: Table<Exercise, string>
  prescriptions!: Table<ExercisePrescription, string>
  sessions!: Table<WorkoutSession, string>
  setLogs!: Table<SetLog, string>
  progression!: Table<ProgressionHistory, string>
  weeklyReviews!: Table<WeeklyReview, string>
  planVersions!: Table<PlanVersion, string>
  recommendations!: Table<Recommendation, string>
  recipes!: Table<Recipe, string>
  checkIns!: Table<DailyCheckIn, string>
  settings!: Table<AppSettings, string>
  waist!: Table<WaistEntry, string>

  constructor() {
    super('personal-fitness-v1')
    this.version(1).stores({
      profile: 'id',
      bodyweight: 'id, date',
      foodActions: 'id, dayOfWeek, timeWindow, category',
      completions: 'id, date, foodActionId',
      workoutPlans: 'id, archived',
      workoutDays: 'id, day',
      exercises: 'id, sourceStatus',
      prescriptions: 'id, workoutDayId, exerciseId',
      sessions: 'id, date, workoutDayId, status',
      setLogs: 'id, sessionId, exerciseId',
      progression: 'id, exerciseId, date',
      weeklyReviews: 'id, weekStart',
      planVersions: 'id, planId, archived, effectiveDate',
      recommendations: 'id, date, type',
      recipes: 'id, category',
      checkIns: 'id, date',
      settings: 'id',
      waist: 'id, date',
    })
  }
}

export const db = new FitnessDB()

function uid(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

async function refreshFoodAndRecipes(): Promise<void> {
  // Only seed food when empty — never re-insert deleted seed rows on revision bumps.
  if ((await db.foodActions.count()) === 0) {
    await db.foodActions.bulkPut(buildFoodActions())
  }
  if ((await db.recipes.count()) === 0) {
    await db.recipes.bulkPut(RECIPES)
  }
}

async function ensureProgramTables(): Promise<void> {
  if ((await db.workoutDays.count()) === 0) {
    await db.workoutDays.bulkPut(WORKOUT_DAYS)
  }
  if ((await db.exercises.count()) === 0) {
    await db.exercises.bulkPut(buildExercises())
  }
  if ((await db.prescriptions.count()) === 0) {
    await db.prescriptions.bulkPut(buildPrescriptions())
  }
}

export async function ensureSeeded(): Promise<void> {
  const count = await db.workoutPlans.count()
  const now = new Date().toISOString()
  const planId = 'plan-v1'

  if (count === 0) {
    await db.transaction(
      'rw',
      [
        db.profile,
        db.workoutPlans,
        db.workoutDays,
        db.exercises,
        db.prescriptions,
        db.foodActions,
        db.recipes,
        db.settings,
        db.planVersions,
      ],
      async () => {
        await db.profile.put({
          id: 'user',
          ...DEFAULT_PROFILE,
          createdAt: now,
          updatedAt: now,
        })

        await db.workoutPlans.put({
          id: planId,
          name: 'Primary Weekly Split',
          version: 1,
          activeFrom: now.slice(0, 10),
          archived: false,
          createdAt: now,
        })

        await db.workoutDays.bulkPut(WORKOUT_DAYS)
        await db.exercises.bulkPut(buildExercises())
        await db.prescriptions.bulkPut(buildPrescriptions())
        await db.foodActions.bulkPut(buildFoodActions())
        await db.recipes.bulkPut(RECIPES)

        await db.planVersions.put({
          id: 'pv-1',
          planId,
          createdAt: now,
          effectiveDate: now.slice(0, 10),
          reason: 'Initial program seed',
          archived: false,
          snapshotJson: JSON.stringify({
            days: WORKOUT_DAYS,
            exercises: buildExercises(),
            prescriptions: buildPrescriptions(),
          }),
        })

        await db.settings.put({
          id: 'settings',
          seedRevision: CURRENT_SEED_REVISION,
          startingWeightKg: DEFAULT_PROFILE.currentWeightKg,
          reminders: {
            bodyweight: true,
            workout: true,
            creatine: true,
            weeklyReview: true,
            mealPrep: false,
          },
        })
      },
    )
    return
  }

  const profile = await db.profile.get('user')
  if (!profile) {
    await db.profile.put({
      id: 'user',
      ...DEFAULT_PROFILE,
      createdAt: now,
      updatedAt: now,
    })
  }

  await ensureProgramTables()

  let settings = await db.settings.get('settings')
  if (!settings) {
    settings = {
      id: 'settings',
      seedRevision: 0,
      startingWeightKg: profile?.currentWeightKg ?? DEFAULT_PROFILE.currentWeightKg,
      reminders: {
        bodyweight: true,
        workout: true,
        creatine: true,
        weeklyReview: true,
        mealPrep: false,
      },
    }
    await db.settings.put(settings)
  }

  if ((settings.seedRevision ?? 0) < CURRENT_SEED_REVISION) {
    await refreshFoodAndRecipes()
    await db.settings.put({
      ...settings,
      seedRevision: CURRENT_SEED_REVISION,
      startingWeightKg:
        settings.startingWeightKg ??
        profile?.currentWeightKg ??
        DEFAULT_PROFILE.currentWeightKg,
    })
  }

  if ((await db.foodActions.count()) === 0) {
    await refreshFoodAndRecipes()
  }

  if ((await db.planVersions.count()) === 0) {
    const days = await db.workoutDays.toArray()
    const exercises = await db.exercises.toArray()
    const prescriptions = await db.prescriptions.toArray()
    await db.planVersions.put({
      id: 'pv-1',
      planId,
      createdAt: now,
      effectiveDate: now.slice(0, 10),
      reason: 'Recovered initial plan version',
      archived: false,
      snapshotJson: JSON.stringify({ days, exercises, prescriptions }),
    })
  }
}

export { uid }
