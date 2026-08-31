import { differenceInCalendarDays, format, getDay, startOfWeek, subDays, addDays } from 'date-fns'
import type { BodyweightEntry, DayOfWeek } from '../models/types'
import { DAYS } from '../models/types'

/**
 * Parse YYYY-MM-DD as a local calendar date.
 * Avoid date-fns parseISO on date-only strings (UTC midnight → wrong weekday in western TZs).
 */
export function parseLocalDate(date: Date | string): Date {
  if (date instanceof Date) return date
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  return new Date(date)
}

/** JS getDay: 0=Sun ... map to our DayOfWeek */
export function dayOfWeekFromDate(date: Date | string): DayOfWeek {
  const d = parseLocalDate(date)
  const js = getDay(d)
  const map: DayOfWeek[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]
  return map[js]
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDisplayDate(date: Date | string): string {
  const d = parseLocalDate(date)
  return format(d, 'EEEE, MMM d')
}

export function greetingForHour(hour = new Date().getHours()): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function weekStartMonday(date: Date | string = new Date()): string {
  const d = parseLocalDate(date)
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export function datesInWeek(weekStart: string): string[] {
  const start = parseLocalDate(weekStart)
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
}

/** Calendar date for a named weekday in the week containing `around` (defaults to today). */
export function dateForWeekday(
  day: DayOfWeek,
  around: Date | string = new Date(),
): string {
  const weekStart = weekStartMonday(around)
  const idx = DAYS.indexOf(day)
  return datesInWeek(weekStart)[idx]
}

export function dayLabelForDate(iso: string): DayOfWeek {
  return dayOfWeekFromDate(iso)
}

export function lastNDates(n: number, from: string = todayISO()): string[] {
  const start = parseLocalDate(from)
  return Array.from({ length: n }, (_, i) => format(subDays(start, n - 1 - i), 'yyyy-MM-dd'))
}

export function isTrainingDay(day: DayOfWeek): boolean {
  return !['Wednesday', 'Sunday'].includes(day)
}

/** First calendar date strictly after `afterISO` that falls on `day`. */
export function nextOccurrenceOfWeekday(day: DayOfWeek, afterISO: string): string {
  const start = parseLocalDate(afterISO)
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(start, i)
    if (dayOfWeekFromDate(candidate) === day) {
      return format(candidate, 'yyyy-MM-dd')
    }
  }
  return dateForWeekday(day, afterISO)
}

/** Whole calendar weeks spanned by weigh-in entries (min 0). */
export function calendarWeeksSpanned(entries: BodyweightEntry[]): number {
  if (entries.length < 2) return entries.length > 0 ? 0.5 : 0
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const days = differenceInCalendarDays(
    parseLocalDate(sorted[sorted.length - 1].date),
    parseLocalDate(sorted[0].date),
  )
  return Math.max(days / 7, 1 / 7)
}

export function friendlySourceNote(note?: string): string {
  if (!note) return ''
  if (/SOURCE-CONFIRMED|CONFIRMED/i.test(note) && !/RECONSTRUCTION/i.test(note)) {
    return 'Confirmed from source'
  }
  if (/RECONSTRUCTION/i.test(note)) {
    return 'Historical reconstruction — editable'
  }
  return note
}

export { DAYS, format, addDays, subDays, differenceInCalendarDays }
