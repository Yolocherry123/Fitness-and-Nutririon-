import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryBadge } from '../components/Badges'
import { HeaderIconButton, useHeaderHints } from '../components/HeaderActions'
import { IconBook, IconCheckIn, IconGear, IconScale } from '../components/Icons'
import { MealProteinModal } from '../components/MealProteinModal'
import { ProteinAddOnModal } from '../components/ProteinAddOnModal'
import { ShakeLogModal } from '../components/ShakeLogModal'
import { SattuLogModal } from '../components/SattuLogModal'
import {
  CalorieToolPickerModal,
  type CalorieToolChoice,
} from '../components/CalorieToolPickerModal'
import { Modal } from '../components/Modal'
import { db, uid } from '../db'
import {
  creatineMissMessage,
  isChickenOrKebabAction,
  isCreatineAction,
  isWheyAction,
  scoreCompletions,
  suggestCalorieGapTool,
} from '../engines/logic'
import {
  buildProteinSummary,
  statusLabel,
  statusTone,
} from '../engines/protein'
import {
  buildProteinChecklistSuggestions,
  EGGS_ACTION_ID,
  isEggsAddOnAction,
} from '../engines/proteinSuggestions'
import { useWorkoutDays } from '../hooks/useProgram'
import {
  formatDisplayDate,
  greetingForHour,
  todayISO,
  dayOfWeekFromDate,
} from '../lib/dates'
import { foodActionsForDate, groupByTimeWindow, highFiberOptionalsDoneToday, WINDOW_LABELS } from '../lib/food'
import { themeForDay } from '../lib/dayTheme'
import { chickenProteinEstimate, defaultCarbsForActionName, defaultProteinForActionName } from '../lib/proteinDb'
import type { ActionCategory, ChickenMeasureType, DigestionStatus, FoodAction } from '../models/types'
import { SATTU_ACTION_ID } from '../models/types'

const MEASURE_OPTIONS: { value: ChickenMeasureType; label: string }[] = [
  { value: 'BONE_IN', label: 'Bone-in serving' },
  { value: 'COOKED_EDIBLE', label: 'Cooked edible meat' },
  { value: 'BREAST', label: 'Breast' },
  { value: 'THIGH', label: 'Thigh' },
]

const TIP_KEY = 'forge-tip-dismissed-v1'
const SHAKE_ACTION_ID = 'shake-extra'

function isSattuAction(action: FoodAction): boolean {
  return action.id === SATTU_ACTION_ID || /sattu/i.test(action.name)
}

function needsMealProteinPicker(action: FoodAction): boolean {
  return /hostel breakfast|hostel lunch|hostel dinner/i.test(action.name)
}

function catClass(category: ActionCategory): string {
  if (category === 'CORE') return 'cat-core'
  if (category === 'SCHEDULED') return 'cat-scheduled'
  return 'cat-optional'
}

export function TodayScreen() {
  const [date, setDate] = useState(todayISO)
  const day = dayOfWeekFromDate(date)

  useEffect(() => {
    const tick = () => setDate(todayISO())
    const id = window.setInterval(tick, 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const profile = useLiveQuery(() => db.profile.get('user'))
  const settings = useLiveQuery(() => db.settings.get('settings'))
  const allFood = useLiveQuery(() => db.foodActions.toArray()) ?? []
  const completions =
    useLiveQuery(() => db.completions.where('date').equals(date).toArray(), [date]) ?? []
  const bwToday = useLiveQuery(() => db.bodyweight.where('date').equals(date).first(), [date])
  const checkIn = useLiveQuery(() => db.checkIns.get(date), [date])
  const workoutDays = useWorkoutDays()
  const workoutDay = workoutDays.find((d) => d.day === day)

  const session = useLiveQuery(async () => {
    if (!workoutDay) return undefined
    const rows = await db.sessions.where('date').equals(date).toArray()
    return rows.find((s) => s.workoutDayId === workoutDay.id)
  }, [date, workoutDay?.id])

  const [bwOpen, setBwOpen] = useState(false)
  const [weight, setWeight] = useState('')
  const [showOptionalExtras, setShowOptionalExtras] = useState(false)
  const [chickenTarget, setChickenTarget] = useState<FoodAction | null>(null)
  const [chickenMeasure, setChickenMeasure] = useState<ChickenMeasureType>('BONE_IN')
  const [chickenQty, setChickenQty] = useState('')
  const [mealTarget, setMealTarget] = useState<FoodAction | null>(null)
  const [shakeOpen, setShakeOpen] = useState<'protein' | 'calories' | 'convenience' | null>(
    null,
  )
  const [eggsOpen, setEggsOpen] = useState(false)
  const [eggsDefaultCount, setEggsDefaultCount] = useState<1 | 2 | 3>(2)
  const [sattuOpen, setSattuOpen] = useState<
    'calories' | 'convenience' | 'protein_caveat' | null
  >(null)
  const [caloriePickerOpen, setCaloriePickerOpen] = useState(false)
  const [proteinDetails, setProteinDetails] = useState(false)
  const [creatineNote, setCreatineNote] = useState<string | null>(null)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [tipOpen, setTipOpen] = useState(() => {
    try {
      return localStorage.getItem(TIP_KEY) !== '1'
    } catch {
      return true
    }
  })
  const [showHints, dismissHints] = useHeaderHints()
  const [pulseId, setPulseId] = useState<string | null>(null)

  const actions = useMemo(
    () =>
      foodActionsForDate(allFood, date, {
        profile,
        digestionMode: profile?.digestionMode,
      }),
    [allFood, date, profile],
  )

  const scores = scoreCompletions(actions, completions)
  const doneMap = new Map(completions.map((c) => [c.foodActionId, c]))

  const creatineAction = actions.find(isCreatineAction)
  const creatineDone = creatineAction
    ? doneMap.get(creatineAction.id)?.completed === true
    : true
  const hasScheduledChicken = actions.some(
    (a) => a.category === 'SCHEDULED' && isChickenOrKebabAction(a),
  )
  const chickenDone = actions
    .filter((a) => isChickenOrKebabAction(a) && a.category === 'SCHEDULED')
    .every((a) => doneMap.get(a.id)?.completed)

  const showGapCard =
    (!creatineDone && !!profile?.usesCreatine) ||
    (hasScheduledChicken && !chickenDone)

  const protein = useMemo(
    () =>
      buildProteinSummary({
        actions,
        completions,
        profile,
        settings,
        caloriesMayHelp: showGapCard && scores.consistencyPct >= 70,
      }),
    [actions, completions, profile, settings, showGapCard, scores.consistencyPct],
  )

  const dayTheme = themeForDay(day)

  const proteinSuggestions = useMemo(
    () =>
      buildProteinChecklistSuggestions({
        protein,
        actions,
        completions,
        profile,
        settings,
      }),
    [protein, actions, completions, profile, settings],
  )

  const suggestionById = useMemo(() => {
    const map = new Map<string, (typeof proteinSuggestions)[number]>()
    for (const s of proteinSuggestions) map.set(s.action.id, s)
    return map
  }, [proteinSuggestions])

  // Synthetic / plan rows to inject (night dairy stays in nightOptionals — badge only)
  const promotedAddOns = proteinSuggestions
    .filter(
      (s) =>
        s.kind === 'eggs' ||
        s.kind === 'whey' ||
        s.kind === 'sattu' ||
        s.kind === 'banana',
    )
    .map((s) => s.action)

  const promotedIds = new Set(promotedAddOns.map((a) => a.id))

  const primaryActions = actions.filter((a) => a.category !== 'OPTIONAL')
  const nightOptionals = actions.filter(
    (a) => a.category === 'OPTIONAL' && a.timeWindow === 'Night',
  )
  const optionalExtras = actions.filter(
    (a) =>
      a.category === 'OPTIONAL' &&
      a.timeWindow !== 'Night' &&
      !promotedIds.has(a.id) &&
      !isEggsAddOnAction(a),
  )

  // Keep checked items in place so a mistaken tap can be unticked immediately
  const listItems = showOptionalExtras
    ? [...primaryActions, ...nightOptionals, ...promotedAddOns, ...optionalExtras]
    : [...primaryActions, ...nightOptionals, ...promotedAddOns]

  const remaining = primaryActions.filter((a) => !doneMap.get(a.id)?.completed)
  const foodGroups = groupByTimeWindow(listItems)
  const nextItem = remaining[0]
  const nextWindow = nextItem
    ? WINDOW_LABELS[nextItem.timeWindow] ?? nextItem.timeWindow
    : null

  const fiberWarning =
    !!profile?.digestionMode || highFiberOptionalsDoneToday(actions, completions)

  async function saveSattuLog(result: {
    estimatedProtein: number
    estimatedCarbs: number
    estimatedCalories: number
    breakdown: import('../models/types').ProteinBreakdownLine[]
    notes: string
  }) {
    const sattuAction =
      actions.find(isSattuAction) ??
      ({
        id: SATTU_ACTION_ID,
        name: 'Sattu drink (optional)',
        dayOfWeek: null,
        timeWindow: 'Afternoon',
        category: 'OPTIONAL' as const,
        sortOrder: 48,
      } satisfies FoodAction)
    await writeCompletion(sattuAction, true, {
      logMode: 'APPROXIMATE',
      estimatedProtein: result.estimatedProtein,
      estimatedCarbs: result.estimatedCarbs,
      estimatedCalories: result.estimatedCalories,
      proteinBreakdown: result.breakdown,
      notes: result.notes,
    })
    setPulseId(sattuAction.id)
    window.setTimeout(() => setPulseId(null), 420)
    setSattuOpen(null)
    setCaloriePickerOpen(false)
  }

  async function quickLogCalorieTool(choice: CalorieToolChoice) {
    if (choice === 'sattu') {
      setCaloriePickerOpen(false)
      setSattuOpen('calories')
      return
    }
    if (choice === 'other') {
      setCaloriePickerOpen(false)
      setShowOptionalExtras(true)
      return
    }

    const matchers: Record<Exclude<CalorieToolChoice, 'sattu' | 'other'>, RegExp> = {
      banana: /banana/i,
      pb_sandwich: /peanut butter sandwich|pb sandwich/i,
      milk: /night milk|milk.*curd/i,
    }
    const pattern = matchers[choice]
    const match = actions.find(
      (a) => a.category === 'OPTIONAL' && pattern.test(a.name),
    )
    if (match) {
      await writeCompletion(match, true, { logMode: 'APPROXIMATE' })
      setPulseId(match.id)
      window.setTimeout(() => setPulseId(null), 420)
    } else {
      const now = new Date().toISOString()
      const id = `calorie-tool:${choice}`
      const labels: Record<string, string> = {
        banana: 'Banana (quick log)',
        pb_sandwich: 'PB sandwich (quick log)',
        milk: 'Milk drink (quick log)',
      }
      await db.completions.put({
        id: `${date}:${id}`,
        date,
        foodActionId: id,
        completed: true,
        logMode: 'APPROXIMATE',
        estimatedProtein: defaultProteinForActionName(labels[choice] ?? choice) ?? 0,
        estimatedCarbs: defaultCarbsForActionName(labels[choice] ?? choice) ?? 0,
        notes: labels[choice] ?? choice,
        updatedAt: now,
      })
    }
    setCaloriePickerOpen(false)
  }

  async function writeCompletion(
    action: FoodAction,
    completed: boolean,
    extra: Partial<import('../models/types').DailyCompletion> = {},
  ) {
    const existing = doneMap.get(action.id)
    const now = new Date().toISOString()
    const estimatedProtein = completed
      ? (extra.estimatedProtein ??
        extra.exactProtein ??
        action.estimatedProteinG ??
        defaultProteinForActionName(action.name))
      : undefined
    const estimatedCarbs = completed
      ? (extra.estimatedCarbs ?? defaultCarbsForActionName(action.name))
      : undefined
    await db.completions.put({
      id: existing?.id ?? `${date}:${action.id}`,
      date,
      foodActionId: action.id,
      completed,
      logMode: extra.logMode ?? existing?.logMode ?? 'CHECKLIST',
      notes: extra.notes ?? existing?.notes,
      chickenMeasure: extra.chickenMeasure ?? existing?.chickenMeasure,
      actualQuantity: extra.actualQuantity ?? existing?.actualQuantity,
      exactCalories: extra.exactCalories ?? existing?.exactCalories,
      exactProtein: extra.exactProtein ?? existing?.exactProtein,
      estimatedProtein,
      estimatedCarbs,
      estimatedCalories: completed
        ? (extra.estimatedCalories ?? existing?.estimatedCalories)
        : undefined,
      proteinBreakdown: completed
        ? (extra.proteinBreakdown ?? existing?.proteinBreakdown)
        : undefined,
      updatedAt: now,
    })
  }

  async function toggle(action: FoodAction) {
    const existing = doneMap.get(action.id)
    const currentlyDone = existing?.completed === true

    if (!currentlyDone && isChickenOrKebabAction(action)) {
      setChickenTarget(action)
      setChickenMeasure(
        action.chickenMeasure ??
          (/kebab/i.test(action.name) ? 'COOKED_EDIBLE' : 'BONE_IN'),
      )
      setChickenQty(existing?.actualQuantity ?? action.quantity ?? '')
      return
    }

    if (!currentlyDone && needsMealProteinPicker(action)) {
      setMealTarget(action)
      return
    }

    if (!currentlyDone && isSattuAction(action)) {
      setSattuOpen(
        protein.sattuProteinCaveat
          ? 'protein_caveat'
          : protein.suggestCalorieTool
            ? 'calories'
            : 'convenience',
      )
      return
    }

    if (!currentlyDone && isWheyAction(action)) {
      setShakeOpen(
        protein.suggestShakeForProtein
          ? 'protein'
          : protein.suggestShakeForCalories
            ? 'calories'
            : 'convenience',
      )
      return
    }

    if (!currentlyDone && isEggsAddOnAction(action)) {
      const count = /3/.test(action.name) ? 3 : /1\b/.test(action.name) ? 1 : 2
      setEggsDefaultCount(count as 1 | 2 | 3)
      setEggsOpen(true)
      return
    }

    if (currentlyDone && isCreatineAction(action)) {
      await writeCompletion(action, false)
      setCreatineNote(creatineMissMessage())
      return
    }

    await writeCompletion(action, !currentlyDone)
    if (isCreatineAction(action) && currentlyDone === false) {
      setCreatineNote(null)
    }
    if (!currentlyDone) {
      setPulseId(action.id)
      window.setTimeout(() => setPulseId(null), 420)
    }
  }

  async function saveChicken() {
    if (!chickenTarget) return
    const proteinG = chickenProteinEstimate(chickenMeasure, chickenQty || undefined)
    await writeCompletion(chickenTarget, true, {
      chickenMeasure,
      actualQuantity: chickenQty || undefined,
      logMode: 'APPROXIMATE',
      estimatedProtein: proteinG,
      estimatedCarbs: 0,
      proteinBreakdown: [
        {
          label: `${chickenMeasure.replace(/_/g, ' ').toLowerCase()} chicken`,
          grams: proteinG,
          source: 'APPROXIMATION',
        },
      ],
      notes: `Logged as ${chickenMeasure.replace('_', ' ').toLowerCase()} · ~${proteinG} g protein (est.)`,
    })
    setChickenTarget(null)
    setPulseId(chickenTarget.id)
    window.setTimeout(() => setPulseId(null), 420)
  }

  async function saveWeight() {
    const w = parseFloat(weight)
    if (!w || w < 30 || w > 200) return
    const now = new Date().toISOString()
    const id = `bw:${date}`
    const existing =
      bwToday ?? (await db.bodyweight.where('date').equals(date).first())
    await db.bodyweight.put({
      id: existing?.id ?? id,
      date,
      weightKg: w,
      conditionsNote: existing?.conditionsNote ?? 'Morning weigh-in',
      createdAt: existing?.createdAt ?? now,
    })
    if (profile) {
      const cur = await db.profile.get('user')
      if (cur) {
        await db.profile.put({
          ...cur,
          currentWeightKg: w,
          updatedAt: now,
        })
      }
    }
    setBwOpen(false)
    setWeight('')
  }

  function dismissTip() {
    try {
      localStorage.setItem(TIP_KEY, '1')
    } catch {
      /* ignore */
    }
    setTipOpen(false)
  }

  return (
    <div className="page">
    <div className="page-header">
        <div className="page-header-main">
          <div className="brand">Forge</div>
          <h1 className="page-title">{greetingForHour()}</h1>
          <p className="hero-status">{formatDisplayDate(date)}</p>
          <div className="day-tint" aria-label={`${dayTheme.label} theme`}>
            <span className="day-tint-dot" />
            <span className="day-tint-label">
              {dayTheme.label} · {dayTheme.mood}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <HeaderIconButton
            label="Weight"
            active={!!bwToday}
            showHint={showHints}
            onHintSeen={dismissHints}
            onClick={() => setBwOpen(true)}
          >
            <IconScale />
          </HeaderIconButton>
          <HeaderIconButton
            label="Check-in"
            active={!!checkIn}
            onClick={() => {
              dismissHints()
              setCheckInOpen(true)
            }}
          >
            <IconCheckIn />
          </HeaderIconButton>
          <HeaderIconButton
            label="Recipes"
            to="/recipes"
            onHintSeen={dismissHints}
          >
            <IconBook />
          </HeaderIconButton>
          <HeaderIconButton
            label="Settings"
            to="/settings"
            onHintSeen={dismissHints}
          >
            <IconGear />
          </HeaderIconButton>
        </div>
      </div>

      {tipOpen && (
        <div className="tip-banner">
          <p>
            Optional items never count as failure. Focus on main meals, training, and creatine —
            extras only when useful.
          </p>
          <button type="button" className="btn btn-secondary" onClick={dismissTip}>
            Got it
          </button>
        </div>
      )}

      {profile?.digestionMode && (
        <div className="card" style={{ marginTop: 12, borderColor: 'rgba(212,165,116,0.35)' }}>
          <strong>Digestion Mode on</strong>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            Fiber extras are hidden. Not a medical diagnosis.
          </p>
        </div>
      )}

      {creatineNote && (
        <div className="card" style={{ marginTop: 12, borderColor: 'rgba(212,165,116,0.4)' }}>
          <strong>Creatine</strong>
          <p className="small muted" style={{ margin: '4px 0 8px' }}>
            {creatineNote}
          </p>
          <button className="btn btn-ghost" onClick={() => setCreatineNote(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Training first — primary action */}
      <div className="card card-strong" style={{ marginTop: 14 }}>
        <div className="row-between">
          <div>
            <div className="check-title">{workoutDay?.workoutName ?? '—'}</div>
            <div className="check-sub">
              {workoutDay?.type.replace('_', ' ')}
              {session?.status === 'COMPLETED' ? ' · Done' : ''}
            </div>
          </div>
          {workoutDay?.type === 'TRAINING' ? (
            <Link
              to={`/workout/session/${workoutDay.id}?date=${date}`}
              className="btn btn-primary"
            >
              {session?.status === 'IN_PROGRESS'
                ? 'Continue'
                : session?.status === 'COMPLETED'
                  ? 'View'
                  : 'Start'}
            </Link>
          ) : workoutDay?.type === 'ACTIVE_RECOVERY' ? (
            <Link
              to={`/workout/session/${workoutDay.id}?date=${date}`}
              className="btn btn-secondary"
            >
              Log walk
            </Link>
          ) : (
            <span className="chip">Rest</span>
          )}
        </div>
      </div>

      {showGapCard && (
        <div className="card reco" style={{ marginTop: 10 }}>
          <div className="reco-primary">
            {!creatineDone && profile?.usesCreatine
              ? 'Take creatine (normal dose)'
              : 'Use today’s scheduled chicken/kebab at dinner'}
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {suggestCalorieGapTool()}
          </p>
        </div>
      )}

      {/* Sticky next strip */}
      <div className="sticky-next" style={{ marginTop: 12 }}>
        <div>
          <strong>
            {nextItem
              ? `Next: ${nextWindow}`
              : remaining.length === 0
                ? 'Day clear'
                : 'Up next'}
          </strong>
          <div className="check-sub">
            {nextItem ? nextItem.name : 'Core + scheduled done'}
          </div>
        </div>
        <span className="chip">{remaining.length} left</span>
      </div>

      <div className={`card protein-card tone-${statusTone(protein.status)}`} style={{ marginTop: 10 }}>
        <div className="row-between" style={{ marginBottom: 6, gap: 8 }}>
          <strong style={{ fontSize: '0.92rem' }}>Macros</strong>
          <div className="row" style={{ gap: 6, flexShrink: 0 }}>
            {optionalExtras.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 8px' }}
                onClick={() => setShowOptionalExtras((v) => !v)}
              >
                {showOptionalExtras
                  ? 'Hide tools'
                  : `Tools (${optionalExtras.length})`}
              </button>
            )}
            <span className="chip">{statusLabel(protein.status)}</span>
          </div>
        </div>
        <div className="macro-grid">
          <div>
            <div className="macro-label">Protein</div>
            <div className="macro-line">
              <strong>{protein.consumedProtein}</strong>
              <span className="muted">+{protein.expectedRemainingProtein}</span>
              <span className="muted">→ {protein.expectedDailyProtein}</span>
              <span className="faint">/ {protein.targetProtein}g</span>
            </div>
          </div>
          <div>
            <div className="macro-label">Carbs</div>
            <div className="macro-line">
              <strong>{protein.consumedCarbs}</strong>
              <span className="muted">+{protein.expectedRemainingCarbs}</span>
              <span className="muted">→ {protein.expectedDailyCarbs}</span>
              <span className="faint">/ {protein.carbTarget}g</span>
            </div>
          </div>
        </div>
        <p className="small muted" style={{ margin: '6px 0 0', lineHeight: 1.35 }}>
          {protein.primaryMessage}
        </p>
        {protein.sattuProteinCaveat && (
          <p className="small" style={{ margin: '6px 0 0', color: 'var(--warn)' }}>
            {protein.sattuProteinCaveat}
          </p>
        )}
        <div className="row macro-actions" style={{ gap: 6, marginTop: 6 }}>
          {(protein.suggestCalorieTool ||
            proteinSuggestions.some(
              (s) =>
                s.goal !== 'logged' &&
                (s.goal === 'carbs' || s.goal === 'calories' || s.kind === 'sattu'),
            )) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1 }}
              onClick={() => setCaloriePickerOpen(true)}
            >
              Add food
            </button>
          )}
          {proteinSuggestions.some(
            (s) => s.kind === 'whey' && s.goal !== 'logged',
          ) &&
            profile?.usesWhey && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ flex: 1 }}
                onClick={() => setShakeOpen('protein')}
              >
                Whey (last)
              </button>
            )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ flex: 1 }}
            onClick={() => setProteinDetails((v) => !v)}
          >
            {proteinDetails ? 'Hide' : 'Details'}
          </button>
        </div>
        {proteinDetails && (
          <div style={{ marginTop: 10 }}>
            <p className="faint small" style={{ marginTop: 0 }}>
              Estimates — hostel portions vary. P {protein.minimumTarget}–{protein.maximumTarget}g · C {protein.carbMinimum}–{protein.carbMaximum}g
            </p>
            {protein.secondaryMessage && (
              <p className="small muted">{protein.secondaryMessage}</p>
            )}
            {protein.sattuProteinCaveat && (
              <p className="small muted">{protein.sattuProteinCaveat}</p>
            )}
            <div className="section-label">Consumed protein (est.)</div>
            {protein.consumedLines.length === 0 && (
              <p className="small muted">Nothing logged yet.</p>
            )}
            {protein.consumedLines.map((l) => (
              <div key={l.foodActionId} className="small muted" style={{ marginBottom: 4 }}>
                {l.name}: ~{l.grams} g
              </div>
            ))}
            <div className="section-label">Expected remaining</div>
            {protein.expectedLines.map((l) => (
              <div key={l.foodActionId} className="small muted" style={{ marginBottom: 4 }}>
                {l.name}: ~{l.grams} g protein
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-label" style={{ marginTop: 4 }}>
        Today&apos;s food
      </div>

      {foodGroups.map((g) => (
        <div key={g.window}>
          <div className="small faint" style={{ margin: '10px 0 6px' }}>
            {WINDOW_LABELS[g.window] ?? g.window}
          </div>
          <div className="stack">
            {g.items.map((a) => {
              const suggestion = suggestionById.get(a.id)
              const showSuggest =
                !!suggestion &&
                suggestion.hint !== 'Logged today.' &&
                doneMap.get(a.id)?.completed !== true
              return (
              <FoodRow
                key={a.id}
                action={a}
                done={doneMap.get(a.id)?.completed === true}
                pulsing={pulseId === a.id}
                detail={doneMap.get(a.id)}
                milkPowder={
                  !!a.allowsMilkPowderSub && !!profile?.milkPowderSubstitute
                }
                suggested={showSuggest ? suggestion.hint : null}
                onToggle={() => toggle(a)}
              />
              )
            })}
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row-between small">
          <span>Core + scheduled</span>
          <span>{scores.consistencyPct}%</span>
        </div>
        <div className="progress-bar" style={{ marginTop: 8 }}>
          <span style={{ width: `${scores.consistencyPct}%` }} />
        </div>
        <p className="small faint" style={{ marginTop: 8, marginBottom: 0 }}>
          {scores.coreDone}/{scores.coreTotal} core · {scores.scheduledDone}/
          {scores.scheduledTotal} scheduled · optional never lowers this
        </p>
      </div>

      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <Link to="/recipes" className="btn btn-secondary" style={{ flex: 1 }}>
          Recipes
        </Link>
        <Link to="/food-plan" className="btn btn-secondary" style={{ flex: 1 }}>
          Food plan
        </Link>
      </div>
      <Link
        to="/data"
        className="btn btn-ghost btn-block"
        style={{ marginTop: 8 }}
      >
        Download / share my data
      </Link>

      {bwOpen && (
        <Modal
          title="Bodyweight"
          subtitle="Similar morning conditions work best."
          onClose={() => setBwOpen(false)}
          footer={
            <button className="btn btn-primary btn-block" onClick={saveWeight}>
              Save
            </button>
          }
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Weight (kg)</label>
            <input
              className="input"
              type="number"
              step="0.1"
              inputMode="decimal"
              value={weight || (bwToday?.weightKg?.toString() ?? '')}
              onChange={(e) => setWeight(e.target.value)}
              autoFocus
            />
          </div>
        </Modal>
      )}

      {chickenTarget && (
        <Modal
          title="Log chicken / kebab"
          subtitle="Bone-in weight is not the same as edible meat weight. Protein stays approximate."
          onClose={() => setChickenTarget(null)}
          footer={
            <button className="btn btn-primary btn-block" onClick={saveChicken}>
              Mark complete
            </button>
          }
        >
          <div className="field">
            <label>Measurement type</label>
            <select
              className="select"
              value={chickenMeasure}
              onChange={(e) =>
                setChickenMeasure(e.target.value as ChickenMeasureType)
              }
            >
              {MEASURE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Quantity (optional)</label>
            <input
              className="input"
              value={chickenQty}
              onChange={(e) => setChickenQty(e.target.value)}
              placeholder="e.g. 320 g"
            />
          </div>
          <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Est. protein ≈{' '}
            {chickenProteinEstimate(chickenMeasure, chickenQty || undefined)} g
          </p>
        </Modal>
      )}

      {mealTarget && (
        <MealProteinModal
          title={mealTarget.name}
          onCancel={() => setMealTarget(null)}
          onSave={async ({ estimatedProtein, estimatedCarbs, breakdown, notes }) => {
            await writeCompletion(mealTarget, true, {
              logMode: breakdown.length ? 'APPROXIMATE' : 'CHECKLIST',
              estimatedProtein,
              estimatedCarbs,
              proteinBreakdown: breakdown,
              notes,
            })
            setPulseId(mealTarget.id)
            setMealTarget(null)
            window.setTimeout(() => setPulseId(null), 420)
          }}
        />
      )}

      {shakeOpen && (
        <ShakeLogModal
          settings={settings}
          reason={shakeOpen}
          onCancel={() => setShakeOpen(null)}
          onSave={async ({ estimatedProtein, estimatedCarbs, estimatedCalories, breakdown, notes }) => {
            const whey =
              actions.find(isWheyAction) ??
              proteinSuggestions.find((s) => s.kind === 'whey')?.action ??
              ({
                id: SHAKE_ACTION_ID,
                name: 'Whey shake (suggested for today)',
                dayOfWeek: null,
                timeWindow: 'Supplements',
                category: 'OPTIONAL' as const,
                sortOrder: 61,
              } satisfies FoodAction)
            await writeCompletion(whey, true, {
              logMode: 'APPROXIMATE',
              estimatedProtein,
              estimatedCarbs,
              estimatedCalories,
              proteinBreakdown: breakdown,
              notes,
            })
            setPulseId(whey.id)
            window.setTimeout(() => setPulseId(null), 420)
            setShakeOpen(null)
          }}
        />
      )}

      {eggsOpen && (
        <ProteinAddOnModal
          title="Add eggs"
          initialCount={eggsDefaultCount}
          onCancel={() => setEggsOpen(false)}
          onSave={async ({ estimatedProtein, estimatedCarbs, breakdown, notes, eggCount }) => {
            const eggsAction: FoodAction = {
              id: EGGS_ACTION_ID,
              name: `Add eggs (${eggCount})`,
              dayOfWeek: null,
              timeWindow: 'Afternoon',
              category: 'OPTIONAL',
              sortOrder: 49,
              quantity: `${eggCount}`,
              unit: eggCount === 1 ? 'egg' : 'eggs',
              estimatedProteinG: estimatedProtein,
              notes,
            }
            await writeCompletion(eggsAction, true, {
              logMode: 'APPROXIMATE',
              estimatedProtein,
              estimatedCarbs,
              proteinBreakdown: breakdown,
              notes,
            })
            setPulseId(EGGS_ACTION_ID)
            window.setTimeout(() => setPulseId(null), 420)
            setEggsOpen(false)
          }}
        />
      )}

      {caloriePickerOpen && (
        <CalorieToolPickerModal
          onCancel={() => setCaloriePickerOpen(false)}
          onSelect={quickLogCalorieTool}
        />
      )}

      {sattuOpen && (
        <SattuLogModal
          settings={settings}
          reason={sattuOpen}
          fiberWarning={fiberWarning}
          onCancel={() => setSattuOpen(null)}
          onSave={saveSattuLog}
        />
      )}

      {checkInOpen && (
        <CheckInModal
          date={date}
          existing={checkIn}
          onClose={() => setCheckInOpen(false)}
        />
      )}
    </div>
  )
}

function FoodRow({
  action,
  done,
  collapsed,
  pulsing,
  detail,
  milkPowder,
  suggested,
  onToggle,
}: {
  action: FoodAction
  done: boolean
  collapsed?: boolean
  pulsing?: boolean
  detail?: import('../models/types').DailyCompletion
  milkPowder: boolean
  suggested?: string | null
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`check-row ${catClass(action.category)}${done ? ' done' : ''}${collapsed ? ' collapsed' : ''}${pulsing ? ' just-checked' : ''}${suggested && !done ? ' suggested' : ''}`}
      onClick={onToggle}
    >
      <span className="check-box">{done ? '✓' : ''}</span>
      <span className="check-meta">
        <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="check-title">{action.name}</span>
          {action.category === 'SCHEDULED' && (
            <CategoryBadge category="SCHEDULED" />
          )}
          {suggested && !done && <span className="chip chip-suggest">Suggested</span>}
        </span>
        {!collapsed && (
          <span className="check-sub">
            {suggested && !done ? `${suggested} · ` : ''}
            {action.quantity
              ? `${action.quantity}${action.unit ? ` ${action.unit}` : ''} · `
              : ''}
            {action.notes}
            {milkPowder ? ' · Milk powder OK' : ''}
            {detail?.chickenMeasure
              ? ` · ${detail.chickenMeasure.replace(/_/g, ' ').toLowerCase()}${detail.actualQuantity ? ` (${detail.actualQuantity})` : ''}`
              : ''}
          </span>
        )}
      </span>
    </button>
  )
}

function CheckInModal({
  date,
  existing,
  onClose,
}: {
  date: string
  existing?: import('../models/types').DailyCheckIn
  onClose: () => void
}) {
  const [energy, setEnergy] = useState(existing?.energy ?? 3)
  const [appetite, setAppetite] = useState(existing?.appetite ?? 3)
  const [digestion, setDigestion] = useState<DigestionStatus>(
    existing?.digestion ?? 'Neutral',
  )
  const [soreness, setSoreness] = useState(existing?.soreness ?? 2)
  const [stress, setStress] = useState(existing?.stress ?? 2)

  async function save() {
    await db.checkIns.put({
      id: date,
      date,
      energy,
      appetite,
      digestion,
      soreness,
      stress,
    })
    onClose()
  }

  return (
    <Modal
      title="Daily check-in"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={save}>
          Save check-in
        </button>
      }
    >
      <ScaleField label="Energy" value={energy} onChange={setEnergy} />
      <ScaleField label="Appetite" value={appetite} onChange={setAppetite} />
      <div className="field">
        <label>Digestion</label>
        <select
          className="select"
          value={digestion}
          onChange={(e) => setDigestion(e.target.value as DigestionStatus)}
        >
          <option>Good</option>
          <option>Neutral</option>
          <option>Poor</option>
        </select>
      </div>
      <ScaleField label="Soreness" value={soreness} onChange={setSoreness} />
      <ScaleField label="Stress" value={stress} onChange={setStress} />
    </Modal>
  )
}

function ScaleField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="field">
      <label>
        {label}: {value}/5
      </label>
      <input
        className="input"
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
