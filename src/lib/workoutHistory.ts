import { db } from '../db'
import type { ProgressionHistory, SetLog } from '../models/types'

export function progressionLabel(action: string): string {
  switch (action) {
    case 'increase_load':
      return 'Increase load/difficulty'
    case 'more_reps':
      return 'Push for more reps'
    case 'review_fatigue':
      return 'Hold / review fatigue'
    default:
      return 'Maintain current approach'
  }
}

/** Most recent progression note for an exercise before `beforeDate` (exclusive). */
export async function getLastProgression(
  exerciseId: string,
  beforeDate: string,
): Promise<ProgressionHistory | undefined> {
  const rows = await db.progression
    .where('exerciseId')
    .equals(exerciseId)
    .toArray()
  return rows
    .filter((r) => r.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
}

export interface PreviousSetPerf {
  setNumber: number
  load?: number
  reps?: number
  rir?: number
}

/** Last completed working sets for an exercise before `beforeDate`. */
export async function getLastWorkingSets(
  exerciseId: string,
  beforeDate: string,
): Promise<{ date: string; sets: PreviousSetPerf[] } | null> {
  const sessions = await db.sessions
    .where('status')
    .equals('COMPLETED')
    .toArray()
  const prior = sessions
    .filter((s) => s.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date))

  for (const s of prior) {
    const logs = await db.setLogs.where('sessionId').equals(s.id).toArray()
    const working = logs
      .filter(
        (l) =>
          l.exerciseId === exerciseId &&
          l.kind === 'WORKING' &&
          l.completed,
      )
      .sort((a, b) => a.setNumber - b.setNumber)
    if (working.length) {
      return {
        date: s.date,
        sets: working.map((l) => ({
          setNumber: l.setNumber,
          load: l.load,
          reps: l.reps,
          rir: l.rir,
        })),
      }
    }
  }
  return null
}

export function summarizePreviousSets(sets: PreviousSetPerf[]): string {
  return sets
    .map((s) => {
      const load = s.load != null ? `${s.load}` : 'BW'
      const reps = s.reps != null ? `${s.reps}` : '?'
      return `${reps}@${load}`
    })
    .join(' · ')
}

/** Prefer live session; avoid duplicate create races via deterministic id. */
export async function findOrCreateSession(input: {
  existing?: { id: string } | null
  date: string
  workoutDayId: string
  planVersionId: string
  create: () => import('../models/types').WorkoutSession
}): Promise<import('../models/types').WorkoutSession> {
  const deterministicId = `sess:${input.date}:${input.workoutDayId}`
  return db.transaction('rw', db.sessions, async () => {
    if (input.existing) {
      const row = await db.sessions.get(input.existing.id)
      if (row) return row
    }
    const byId = await db.sessions.get(deterministicId)
    if (byId) return byId

    const rows = await db.sessions.where('date').equals(input.date).toArray()
    const found = rows.find((s) => s.workoutDayId === input.workoutDayId)
    if (found) return found

    const created = input.create()
    const s = { ...created, id: deterministicId }
    await db.sessions.put(s)
    return s
  })
}

export async function freshWorkingLogs(
  sessionId: string,
  exerciseId: string,
): Promise<SetLog[]> {
  const logs = await db.setLogs.where('sessionId').equals(sessionId).toArray()
  return logs.filter((l) => l.exerciseId === exerciseId && l.kind === 'WORKING')
}
