import { db } from '../db'
import { todayISO } from './dates'

export type BackupPayload = {
  exportedAt: string
  profile: unknown[]
  bodyweight: unknown[]
  completions: unknown[]
  sessions: unknown[]
  setLogs: unknown[]
  weeklyReviews: unknown[]
  recommendations: unknown[]
  planVersions: unknown[]
  checkIns: unknown[]
  settings: unknown[]
  workoutPlans: unknown[]
  workoutDays: unknown[]
  exercises: unknown[]
  prescriptions: unknown[]
  foodActions: unknown[]
  recipes: unknown[]
  progression: unknown[]
  waist: unknown[]
}

const TABLES = [
  'profile',
  'bodyweight',
  'completions',
  'sessions',
  'setLogs',
  'weeklyReviews',
  'recommendations',
  'planVersions',
  'checkIns',
  'settings',
  'workoutPlans',
  'workoutDays',
  'exercises',
  'prescriptions',
  'foodActions',
  'recipes',
  'progression',
  'waist',
] as const

export async function buildBackupPayload(): Promise<BackupPayload> {
  return {
    exportedAt: new Date().toISOString(),
    profile: await db.profile.toArray(),
    bodyweight: await db.bodyweight.toArray(),
    completions: await db.completions.toArray(),
    sessions: await db.sessions.toArray(),
    setLogs: await db.setLogs.toArray(),
    weeklyReviews: await db.weeklyReviews.toArray(),
    recommendations: await db.recommendations.toArray(),
    planVersions: await db.planVersions.toArray(),
    checkIns: await db.checkIns.toArray(),
    settings: await db.settings.toArray(),
    workoutPlans: await db.workoutPlans.toArray(),
    workoutDays: await db.workoutDays.toArray(),
    exercises: await db.exercises.toArray(),
    prescriptions: await db.prescriptions.toArray(),
    foodActions: await db.foodActions.toArray(),
    recipes: await db.recipes.toArray(),
    progression: await db.progression.toArray(),
    waist: await db.waist.toArray(),
  }
}

export function backupFilename(date = new Date()): string {
  return `forge-backup-${todayISO()}.json`
}

export async function createBackupBlob(): Promise<{ blob: Blob; filename: string }> {
  const payload = await buildBackupPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  return { blob, filename: backupFilename() }
}

/** Triggers a file download to the device Downloads folder. */
export async function downloadBackup(): Promise<string> {
  const { blob, filename } = await createBackupBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return filename
}

/**
 * Prefer the system share sheet (Files / Drive / Messages) when available;
 * otherwise fall back to a normal download.
 */
export async function shareOrDownloadBackup(): Promise<'shared' | 'downloaded'> {
  const { blob, filename } = await createBackupBlob()
  const file = new File([blob], filename, { type: 'application/json' })

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Forge backup',
        text: 'Personal fitness backup (logs + plan)',
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

/**
 * Full restore: clears tracked tables then writes the backup.
 * Avoids hybrid DB where leftover local IDs survive a merge-only import.
 */
export async function importBackupJson(file: File): Promise<void> {
  const text = await file.text()
  const data = JSON.parse(text) as Partial<BackupPayload>

  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const name of TABLES) {
      await db.table(name).clear()
    }
    if (data.profile) await db.profile.bulkPut(data.profile as never[])
    if (data.bodyweight) await db.bodyweight.bulkPut(data.bodyweight as never[])
    if (data.completions) await db.completions.bulkPut(data.completions as never[])
    if (data.sessions) await db.sessions.bulkPut(data.sessions as never[])
    if (data.setLogs) await db.setLogs.bulkPut(data.setLogs as never[])
    if (data.weeklyReviews) await db.weeklyReviews.bulkPut(data.weeklyReviews as never[])
    if (data.recommendations)
      await db.recommendations.bulkPut(data.recommendations as never[])
    if (data.planVersions) await db.planVersions.bulkPut(data.planVersions as never[])
    if (data.checkIns) await db.checkIns.bulkPut(data.checkIns as never[])
    if (data.settings) await db.settings.bulkPut(data.settings as never[])
    if (data.workoutPlans) await db.workoutPlans.bulkPut(data.workoutPlans as never[])
    if (data.workoutDays) await db.workoutDays.bulkPut(data.workoutDays as never[])
    if (data.exercises) await db.exercises.bulkPut(data.exercises as never[])
    if (data.prescriptions) await db.prescriptions.bulkPut(data.prescriptions as never[])
    if (data.foodActions) await db.foodActions.bulkPut(data.foodActions as never[])
    if (data.recipes) await db.recipes.bulkPut(data.recipes as never[])
    if (data.progression) await db.progression.bulkPut(data.progression as never[])
    if (data.waist) await db.waist.bulkPut(data.waist as never[])
  })
}
