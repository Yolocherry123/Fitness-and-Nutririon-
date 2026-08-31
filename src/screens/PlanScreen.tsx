import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryBadge } from '../components/Badges'
import { db } from '../db'
import { scoreCompletions } from '../engines/logic'
import { useWorkoutDays } from '../hooks/useProgram'
import {
  dateForWeekday,
  dayOfWeekFromDate,
  friendlySourceNote,
  todayISO,
  weekStartMonday,
  datesInWeek,
} from '../lib/dates'
import { foodActionsForDay, groupByTimeWindow, WINDOW_LABELS } from '../lib/food'
import type { DayOfWeek, FoodAction, UserProfile, WorkoutDayType } from '../models/types'
import { DAYS } from '../models/types'

const ABBR: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
}

export function PlanScreen() {
  const [tab, setTab] = useState<'week' | 'food'>('week')
  const today = todayISO()
  const todayDay = dayOfWeekFromDate(today)
  const [selected, setSelected] = useState<DayOfWeek>(todayDay)
  const weekStart = weekStartMonday(today)
  const dates = datesInWeek(weekStart)
  const allFood = useLiveQuery(() => db.foodActions.toArray()) ?? []
  const profile = useLiveQuery(() => db.profile.get('user'))
  const workoutDays = useWorkoutDays()
  const weekCompletions =
    useLiveQuery(async () => {
      return db.completions
        .where('date')
        .between(dates[0], dates[6], true, true)
        .toArray()
    }, [weekStart]) ?? []

  useEffect(() => {
    setSelected(todayDay)
  }, [todayDay])

  const selectedWd = workoutDays.find((d) => d.day === selected)
  const selectedDate = dateForWeekday(selected, today)

  return (
    <div className="page">
      <h1>Plan</h1>
      <p className="muted small">Swipe the week · tap a day for the full plan.</p>

      <Link to="/food-plan" className="btn btn-secondary btn-block" style={{ marginBottom: 8 }}>
        Edit food plan
      </Link>

      <div className="row" style={{ margin: '14px 0', gap: 8 }}>
        <button
          className={`btn ${tab === 'week' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setTab('week')}
        >
          Weekly
        </button>
        <button
          className={`btn ${tab === 'food' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setTab('food')}
        >
          Food
        </button>
      </div>

      {tab === 'week' && (
        <>
          <div className="day-strip">
            {DAYS.map((day, i) => {
              const date = dates[i]
              const isToday = day === todayDay
              const isFuture = date > today
              const dayFood = foodActionsForDay(allFood, day, { profile }).filter(
                (a) => a.category !== 'OPTIONAL',
              )
              const comps = weekCompletions.filter((c) => c.date === date)
              const scores = scoreCompletions(dayFood, comps)
              const wd = workoutDays.find((d) => d.day === day)
              const short =
                wd?.type === 'REST'
                  ? 'Rest'
                  : wd?.type === 'ACTIVE_RECOVERY'
                    ? 'Rec'
                    : (wd?.workoutName.split(' ')[0] ?? '—')
              return (
                <button
                  key={day}
                  type="button"
                  className={`day-chip${isToday ? ' today' : ''}${selected === day ? ' selected' : ''}`}
                  onClick={() => setSelected(day)}
                >
                  <div className="day-abbr">{ABBR[day]}</div>
                  <div className="day-meta">{short}</div>
                  <div className="day-meta">
                    {isFuture ? '—' : `${scores.consistencyPct}%`}
                  </div>
                </button>
              )
            })}
          </div>

          <DayDetail
            day={selected}
            date={selectedDate}
            allFood={allFood}
            profile={profile}
            workoutName={selectedWd?.workoutName}
            sourceNote={selectedWd?.sourceNote}
            workoutDayId={selectedWd?.id}
            workoutType={selectedWd?.type}
          />
        </>
      )}

      {tab === 'food' && (
        <FoodWeekView allFood={allFood} todayDay={todayDay} profile={profile} />
      )}
    </div>
  )
}

function DayDetail({
  day,
  date,
  allFood,
  profile,
  workoutName,
  sourceNote,
  workoutDayId,
  workoutType,
}: {
  day: DayOfWeek
  date: string
  allFood: FoodAction[]
  profile: UserProfile | undefined
  workoutName?: string
  sourceNote?: string
  workoutDayId?: string
  workoutType?: WorkoutDayType
}) {
  const actions = foodActionsForDay(allFood, day, { profile })
  const groups = groupByTimeWindow(actions)
  const completions =
    useLiveQuery(() => db.completions.where('date').equals(date).toArray(), [date]) ?? []
  const doneMap = new Map(completions.map((c) => [c.foodActionId, c.completed]))
  const scores = scoreCompletions(
    actions.filter((a) => a.category !== 'OPTIONAL'),
    completions,
  )
  const isFuture = date > todayISO()

  return (
    <div>
      <div className="card card-strong" style={{ marginBottom: 12 }}>
        <div className="row-between">
          <div>
            <div className="check-title">
              {day}
              {day === dayOfWeekFromDate(todayISO()) ? ' · Today' : ''}
            </div>
            <div className="check-sub">{date}</div>
          </div>
          <span className="chip">{isFuture ? '—' : `${scores.consistencyPct}%`}</span>
        </div>
        <div className="check-title" style={{ marginTop: 10 }}>
          {workoutName}
        </div>
        <div className="check-sub">{friendlySourceNote(sourceNote)}</div>
        {workoutType === 'TRAINING' && workoutDayId && (
          <Link
            to={`/workout/session/${workoutDayId}?date=${date}`}
            className="btn btn-primary"
            style={{ marginTop: 10, display: 'inline-flex' }}
          >
            Open workout
          </Link>
        )}
      </div>
      {groups.map((g) => (
        <div key={g.window}>
          <div className="section-label">{WINDOW_LABELS[g.window] ?? g.window}</div>
          {g.items.map((a) => (
            <div
              key={a.id}
              className={`check-row cat-${a.category.toLowerCase()}${doneMap.get(a.id) ? ' done' : ''}`}
            >
              <span className="check-box">{doneMap.get(a.id) ? '✓' : ''}</span>
              <span className="check-meta">
                <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="check-title">{a.name}</span>
                  {a.category === 'SCHEDULED' && (
                    <CategoryBadge category="SCHEDULED" />
                  )}
                </span>
                {a.notes && <span className="check-sub">{a.notes}</span>}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function FoodWeekView({
  allFood,
  todayDay,
  profile,
}: {
  allFood: FoodAction[]
  todayDay: DayOfWeek
  profile: UserProfile | undefined
}) {
  return (
    <div className="stack">
      {DAYS.map((day) => {
        const actions = foodActionsForDay(allFood, day, { profile })
        const scheduled = actions.filter((a) => a.category === 'SCHEDULED')
        const isToday = day === todayDay
        return (
          <div key={day} className={`card${isToday ? ' pill-today' : ''}`}>
            <strong>
              {day}
              {isToday ? ' · Today' : ''}
            </strong>
            <div className="small muted" style={{ marginTop: 8 }}>
              {[
                'Morning',
                'Breakfast',
                'Lunch',
                'Afternoon',
                'Supplements',
                'Dinner',
                'Night',
              ].map((w) => {
                const items = actions.filter((a) => a.timeWindow === w)
                if (!items.length) return null
                return (
                  <div key={w} style={{ marginBottom: 6 }}>
                    <div className="faint" style={{ fontSize: '0.72rem' }}>
                      {WINDOW_LABELS[w] ?? w}
                    </div>
                    {items.map((a) => (
                      <div key={a.id}>
                        {a.category === 'OPTIONAL' ? '○ ' : '• '}
                        {a.name}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
            {scheduled.some((s) => /chicken|kebab/i.test(s.name)) && (
              <div className="chip" style={{ marginTop: 6 }}>
                {scheduled.find((s) => /chicken|kebab/i.test(s.name))!.name}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
