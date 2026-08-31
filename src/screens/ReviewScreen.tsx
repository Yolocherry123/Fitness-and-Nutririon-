import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db, uid } from '../db'
import {
  averageWeight,
  recommendCalorieAdjustment,
  scoreCompletions,
} from '../engines/logic'
import { useWorkoutDays } from '../hooks/useProgram'
import {
  datesInWeek,
  dayOfWeekFromDate,
  todayISO,
  weekStartMonday,
  subDays,
  format,
  parseLocalDate,
  calendarWeeksSpanned,
} from '../lib/dates'
import { foodActionsForDay } from '../lib/food'
import type { CalorieRecommendation } from '../models/types'

function labelFor(r: CalorieRecommendation): string {
  switch (r) {
    case 'INCREASE':
      return 'Add ~100–150 kcal/day'
    case 'DECREASE':
      return 'Reduce ~100–150 kcal/day'
    case 'COLLECT_MORE_DATA':
      return 'Collect more data'
    default:
      return 'Continue current plan'
  }
}

const PREP_KEYS = [
  'Oats available',
  'Bananas',
  'Peanut butter',
  'Milk powder',
  'Creatine',
  'Whey (if used)',
  'Plan chicken/kebab purchases',
  'Workout access / equipment',
] as const

export function ReviewScreen() {
  const today = todayISO()
  const [offsetWeeks, setOffsetWeeks] = useState(0)
  const baseWeek = weekStartMonday(today)
  const weekStart = format(
    subDays(parseLocalDate(baseWeek), offsetWeeks * 7),
    'yyyy-MM-dd',
  )
  const dates = datesInWeek(weekStart)
  const profile = useLiveQuery(() => db.profile.get('user'))
  const allFood = useLiveQuery(() => db.foodActions.toArray()) ?? []
  const workoutDays = useWorkoutDays()
  const completions =
    useLiveQuery(
      () =>
        db.completions
          .where('date')
          .between(dates[0], dates[6], true, true)
          .toArray(),
      [weekStart],
    ) ?? []
  const sessions =
    useLiveQuery(
      () =>
        db.sessions
          .where('date')
          .between(dates[0], dates[6], true, true)
          .toArray(),
      [weekStart],
    ) ?? []
  const checkIns =
    useLiveQuery(
      () =>
        db.checkIns
          .where('date')
          .between(dates[0], dates[6], true, true)
          .toArray(),
      [weekStart],
    ) ?? []
  const bw = useLiveQuery(() => db.bodyweight.orderBy('date').toArray()) ?? []
  const saved = useLiveQuery(
    () => db.weeklyReviews.where('weekStart').equals(weekStart).first(),
    [weekStart],
  )
  const [prep, setPrep] = useState<Record<string, boolean>>({})
  const [applyMsg, setApplyMsg] = useState('')

  const appliedRec =
    useLiveQuery(
      () =>
        db.recommendations
          .filter(
            (r) =>
              r.type === 'weekly_calorie_applied' &&
              ((r.inputWindow != null && r.inputWindow.endsWith(dates[6])) ||
                (r.date >= dates[0] && r.date <= dates[6])),
          )
          .first(),
      [weekStart],
    ) ?? null

  useEffect(() => {
    try {
      setPrep(JSON.parse(localStorage.getItem(`prep-${weekStart}`) ?? '{}'))
    } catch {
      setPrep({})
    }
    setApplyMsg('')
  }, [weekStart])

  const weekBw = bw.filter((e) => dates.includes(e.date))
  const avg = averageWeight(weekBw)

  const prevStart = format(subDays(parseLocalDate(weekStart), 7), 'yyyy-MM-dd')
  const prevDates = datesInWeek(prevStart)
  const prevBw = bw.filter((e) => prevDates.includes(e.date))
  const prevAvg = averageWeight(prevBw)
  const change = avg != null && prevAvg != null ? avg - prevAvg : null

  const trainingIds = new Set(
    workoutDays.filter((d) => d.type === 'TRAINING').map((d) => d.id),
  )
  const planned = trainingIds.size
  const completed = sessions.filter(
    (s) => s.status === 'COMPLETED' && trainingIds.has(s.workoutDayId),
  ).length

  const nutrition = useMemo(() => {
    let coreDone = 0
    let coreTotal = 0
    let creatineDone = 0
    let creatineTotal = 0
    for (const date of dates) {
      const day = dayOfWeekFromDate(date)
      const actions = foodActionsForDay(allFood, day, { profile }).filter(
        (a) => a.category === 'CORE' || a.category === 'SCHEDULED',
      )
      const comps = completions.filter((c) => c.date === date)
      const scores = scoreCompletions(actions, comps)
      coreDone += scores.coreDone + scores.scheduledDone
      coreTotal += scores.coreTotal + scores.scheduledTotal

      const creatine = foodActionsForDay(allFood, day, { profile }).find((a) =>
        /creatine/i.test(a.name),
      )
      if (creatine) {
        creatineTotal++
        if (comps.find((c) => c.foodActionId === creatine.id)?.completed) {
          creatineDone++
        }
      }
    }
    return {
      consistency: coreTotal ? Math.round((coreDone / coreTotal) * 100) : 0,
      creatine: creatineTotal
        ? Math.round((creatineDone / creatineTotal) * 100)
        : 0,
    }
  }, [allFood, completions, dates, profile])

  const trendEntries = bw.filter((e) => e.date >= prevStart && e.date <= dates[6])
  const advice = recommendCalorieAdjustment({
    entries: trendEntries,
    adherencePct: nutrition.consistency,
    weeksOfData: calendarWeeksSpanned(trendEntries),
  })

  const digestionPoor = checkIns.filter((c) => c.digestion === 'Poor').length
  const avgEnergy =
    checkIns.length > 0
      ? checkIns.reduce((s, c) => s + (c.energy ?? 0), 0) / checkIns.length
      : null

  const recentProgression =
    useLiveQuery(async () => {
      const rows = await db.progression.toArray()
      return rows
        .filter((p) => p.date >= dates[0] && p.date <= dates[6])
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6)
    }, [weekStart]) ?? []

  async function saveReview() {
    const previousTarget = profile
      ? `${profile.calorieTargetMin}–${profile.calorieTargetMax}`
      : undefined
    await db.weeklyReviews.put({
      id: `wr-${weekStart}`,
      weekStart,
      avgWeightKg: avg ?? undefined,
      weightChangeKg: change ?? undefined,
      workoutsPlanned: planned,
      workoutsCompleted: completed,
      nutritionCorePct: nutrition.consistency,
      creatinePct: nutrition.creatine,
      sleepNotes:
        avgEnergy != null
          ? `Avg energy ${avgEnergy.toFixed(1)}/5; poor digestion days: ${digestionPoor}`
          : undefined,
      recommendation: advice.recommendation,
      reason: advice.reason,
      confidence: advice.confidence,
      createdAt: new Date().toISOString(),
    })
    await db.recommendations.put({
      id: uid('rec'),
      date: today,
      type: 'weekly_calorie',
      primary: labelFor(advice.recommendation),
      reason: advice.reason,
      confidence: advice.confidence,
      inputWindow: `${prevStart} → ${dates[6]}`,
      previousTarget,
    })
  }

  async function applyCalorieChange() {
    if (!profile) return
    if (
      advice.recommendation !== 'INCREASE' &&
      advice.recommendation !== 'DECREASE'
    ) {
      return
    }
    const cur = await db.profile.get('user')
    if (!cur) return
    const delta = advice.recommendation === 'INCREASE' ? 125 : -125
    const previousTarget = `${cur.calorieTargetMin}–${cur.calorieTargetMax}`
    const newMin = Math.max(1500, cur.calorieTargetMin + delta)
    const newMax = Math.max(newMin + 100, cur.calorieTargetMax + delta)
    const newTarget = `${newMin}–${newMax}`
    await db.profile.put({
      ...cur,
      calorieTargetMin: newMin,
      calorieTargetMax: newMax,
      updatedAt: new Date().toISOString(),
    })
    await db.recommendations.put({
      id: uid('rec'),
      date: today,
      type: 'weekly_calorie_applied',
      primary: labelFor(advice.recommendation),
      reason: advice.reason,
      confidence: advice.confidence,
      inputWindow: `${prevStart} → ${dates[6]}`,
      previousTarget,
      newTarget,
    })
    await saveReview()
    setApplyMsg(`Targets updated to ${newTarget} kcal/day.`)
  }

  function togglePrep(key: string) {
    const next = { ...prep, [key]: !prep[key] }
    setPrep(next)
    localStorage.setItem(`prep-${weekStart}`, JSON.stringify(next))
  }

  const isSunday = dayOfWeekFromDate(today) === 'Sunday' && offsetWeeks === 0
  const canApply =
    (advice.recommendation === 'INCREASE' ||
      advice.recommendation === 'DECREASE') &&
    !appliedRec

  return (
    <div className="page">
      <h1>Weekly review</h1>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <button
          className="btn btn-ghost"
          onClick={() => setOffsetWeeks((w) => w + 1)}
        >
          ← Prior
        </button>
        <p className="muted small" style={{ margin: 0 }}>
          Week of {weekStart}
        </p>
        <button
          className="btn btn-ghost"
          disabled={offsetWeeks === 0}
          onClick={() => setOffsetWeeks((w) => Math.max(0, w - 1))}
        >
          Next →
        </button>
      </div>

      <div className="section-label">Bodyweight</div>
      <div className="row" style={{ gap: 8 }}>
        <div className="stat" style={{ flex: 1 }}>
          <div className="stat-value">{avg != null ? avg.toFixed(1) : '—'}</div>
          <div className="stat-label">Avg kg</div>
        </div>
        <div className="stat" style={{ flex: 1 }}>
          <div className="stat-value">
            {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}` : '—'}
          </div>
          <div className="stat-label">Change</div>
        </div>
      </div>

      <div className="section-label">Training</div>
      <div className="card">
        <strong>
          {completed}/{planned} hard workouts completed
        </strong>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Active recovery is tracked separately and does not inflate this count.
        </p>
      </div>

      <div className="section-label">Nutrition & supplements</div>
      <div className="row" style={{ gap: 8 }}>
        <div className="stat" style={{ flex: 1 }}>
          <div className="stat-value">{nutrition.consistency}%</div>
          <div className="stat-label">Core+Sched</div>
        </div>
        <div className="stat" style={{ flex: 1 }}>
          <div className="stat-value">{nutrition.creatine}%</div>
          <div className="stat-label">Creatine</div>
        </div>
      </div>

      {checkIns.length > 0 && (
        <>
          <div className="section-label">Check-in context</div>
          <div className="card small muted">
            Avg energy {avgEnergy?.toFixed(1)}/5 · Poor digestion days:{' '}
            {digestionPoor}
          </div>
        </>
      )}

      <div className="section-label">Primary recommendation</div>
      <div className="card card-strong">
        <div className="reco">
          <div className="reco-primary">{labelFor(advice.recommendation)}</div>
          <p className="small muted" style={{ marginTop: 8 }}>
            {advice.reason}
          </p>
          <p className="faint small">
            Based on ~{advice.weeksOfData.toFixed(1)} weeks of weigh-ins ·{' '}
            {advice.confidence === 'HIGH'
              ? 'strong data'
              : advice.confidence === 'MEDIUM'
                ? 'useful but incomplete'
                : 'not enough data yet'}
          </p>
          <p className="small muted" style={{ marginTop: 6 }}>
            Current target: {profile?.calorieTargetMin}–{profile?.calorieTargetMax} kcal
          </p>
        </div>
        {canApply && (
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 12 }}
            onClick={applyCalorieChange}
          >
            Apply ±125 kcal to targets
          </button>
        )}
        {appliedRec && !applyMsg && (
          <p className="small muted" style={{ marginTop: 8 }}>
            Already applied this week
            {appliedRec.newTarget ? ` → ${appliedRec.newTarget} kcal` : ''}.
          </p>
        )}
        {applyMsg && (
          <p className="small muted" style={{ marginTop: 8 }}>
            {applyMsg}
          </p>
        )}
        {advice.recommendation === 'INCREASE' && !canApply && !applyMsg && (
          <p className="small" style={{ marginTop: 8 }}>
            Secondary: add ONE practical calorie tool — do not stack everything.
          </p>
        )}
      </div>

      {recentProgression.length > 0 && (
        <>
          <div className="section-label">Strength notes this week</div>
          <div className="card">
            {recentProgression.map((p) => (
              <div key={p.id} className="small muted" style={{ marginBottom: 6 }}>
                {p.date}: {p.recommendation.replace(/_/g, ' ')} — {p.reason}
              </div>
            ))}
          </div>
        </>
      )}

      <button
        className="btn btn-secondary btn-block"
        style={{ marginTop: 16 }}
        onClick={saveReview}
      >
        {saved ? 'Update saved review' : 'Save this review'}
      </button>

      {(isSunday || offsetWeeks === 0) && (
        <>
          <div className="section-label">Sunday prep checklist</div>
          <div className="card">
            {PREP_KEYS.map((text) => (
              <label key={text} className="check-row" style={{ marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={!!prep[text]}
                  onChange={() => togglePrep(text)}
                />
                <span className="check-title" style={{ fontWeight: 500 }}>
                  {text}
                </span>
              </label>
            ))}
            <p className="faint small" style={{ marginBottom: 0 }}>
              Preparation only — not a nutrition score.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
