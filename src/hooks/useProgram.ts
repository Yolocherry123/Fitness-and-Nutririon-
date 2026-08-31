import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db'
import type {
  Exercise,
  ExercisePrescription,
  PlanVersion,
  Recipe,
  WorkoutDay,
} from '../models/types'
import { DAYS } from '../models/types'
import { todayISO } from '../lib/dates'

export function useWorkoutDays(): WorkoutDay[] {
  return (
    useLiveQuery(async () => {
      const days = await db.workoutDays.toArray()
      return [...days].sort(
        (a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day),
      )
    }) ?? []
  )
}

export function useActivePlanVersion(): PlanVersion | undefined {
  return useLiveQuery(() =>
    db.planVersions.filter((p) => !p.archived).first(),
  )
}

export function useExercises(): Exercise[] {
  return useLiveQuery(() => db.exercises.toArray()) ?? []
}

export function usePrescriptions(workoutDayId?: string): ExercisePrescription[] {
  return (
    useLiveQuery(async () => {
      if (!workoutDayId) return []
      return db.prescriptions.where('workoutDayId').equals(workoutDayId).sortBy('order')
    }, [workoutDayId]) ?? []
  )
}

export async function getActivePlanVersionId(): Promise<string> {
  const v = await db.planVersions.filter((p) => !p.archived).first()
  return v?.id ?? 'pv-1'
}

/** Archive current plan version and create a new one from live tables. */
export async function archiveAndCreatePlanVersion(reason: string): Promise<string> {
  const now = new Date().toISOString()
  const plan = await db.workoutPlans.filter((p) => !p.archived).first()
  const planId = plan?.id ?? 'plan-v1'
  const days = await db.workoutDays.toArray()
  const exercises = await db.exercises.toArray()
  const prescriptions = await db.prescriptions.toArray()
  const newId = uid('pv')

  await db.transaction('rw', db.planVersions, db.workoutPlans, async () => {
    const active = await db.planVersions.filter((p) => !p.archived).toArray()
    for (const v of active) {
      await db.planVersions.put({ ...v, archived: true })
    }

    await db.planVersions.put({
      id: newId,
      planId,
      createdAt: now,
      effectiveDate: todayISO(),
      reason,
      archived: false,
      snapshotJson: JSON.stringify({ days, exercises, prescriptions }),
    })

    if (plan) {
      await db.workoutPlans.put({
        ...plan,
        version: (plan.version ?? 1) + 1,
        activeFrom: todayISO(),
      })
    }
  })

  return newId
}

export async function updateExerciseAsCustom(
  exerciseId: string,
  patch: Partial<Exercise>,
): Promise<void> {
  const ex = await db.exercises.get(exerciseId)
  if (!ex) return
  await db.exercises.put({
    ...ex,
    ...patch,
    sourceStatus: 'CUSTOM',
  })
}

export async function upsertPrescription(
  rx: ExercisePrescription,
): Promise<void> {
  await db.prescriptions.put(rx)
}

export async function addExerciseToDay(input: {
  workoutDayId: string
  name: string
  sets: number
  repMin: number
  repMax: number
  targetRIRMin: number
  targetRIRMax: number
  restSecondsSuggested: number
  perSide?: boolean
  notes?: string
  variationOptions?: string[]
}): Promise<{ exerciseId: string; prescriptionId: string }> {
  const existing = await db.prescriptions
    .where('workoutDayId')
    .equals(input.workoutDayId)
    .toArray()
  const order =
    existing.reduce((max, r) => Math.max(max, r.order), 0) + 1

  const exerciseId = uid('ex')
  const prescriptionId = uid('rx')

  await db.exercises.put({
    id: exerciseId,
    name: input.name.trim(),
    sourceStatus: 'CUSTOM',
    notes: input.notes,
    allowsVariationChoice: (input.variationOptions?.length ?? 0) > 0,
    variationOptions: input.variationOptions?.length
      ? input.variationOptions
      : undefined,
  })

  await db.prescriptions.put({
    id: prescriptionId,
    exerciseId,
    workoutDayId: input.workoutDayId,
    order,
    sets: input.sets,
    repMin: input.repMin,
    repMax: input.repMax,
    targetRIRMin: input.targetRIRMin,
    targetRIRMax: input.targetRIRMax,
    restSecondsSuggested: input.restSecondsSuggested,
    perSide: input.perSide,
    notes: input.notes,
  })

  return { exerciseId, prescriptionId }
}

/** Remove prescription from a day. Keeps exercise row if used elsewhere; deletes orphan custom exercises. */
export async function removePrescriptionFromDay(
  prescriptionId: string,
): Promise<void> {
  const rx = await db.prescriptions.get(prescriptionId)
  if (!rx) return
  await db.prescriptions.delete(prescriptionId)

  const stillUsed = await db.prescriptions
    .where('exerciseId')
    .equals(rx.exerciseId)
    .count()
  if (stillUsed === 0) {
    const ex = await db.exercises.get(rx.exerciseId)
    if (ex?.sourceStatus === 'CUSTOM') {
      await db.exercises.delete(rx.exerciseId)
    }
  }
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  await db.recipes.put(recipe)
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipes.delete(id)
}

