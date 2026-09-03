import type { DayOfWeek } from '../models/types'
import { DAYS } from '../models/types'

/** Per-weekday visual identity — accent + atmospheric glows for dark UI. */
export interface DayTheme {
  day: DayOfWeek
  label: string
  /** Short mood line for Today header */
  mood: string
  accent: string
  accentStrong: string
  accentSoft: string
  glowA: string
  glowB: string
  bg0: string
  bg1: string
}

export const DAY_THEMES: Record<DayOfWeek, DayTheme> = {
  Monday: {
    day: 'Monday',
    label: 'Monday',
    mood: 'Fresh start teal',
    accent: '#5fbfb0',
    accentStrong: '#3fa396',
    accentSoft: 'rgba(95, 191, 176, 0.18)',
    glowA: 'rgba(95, 191, 176, 0.16)',
    glowB: 'rgba(90, 140, 160, 0.10)',
    bg0: '#0b1416',
    bg1: '#10201f',
  },
  Tuesday: {
    day: 'Tuesday',
    label: 'Tuesday',
    mood: 'Steel focus',
    accent: '#7aa8c4',
    accentStrong: '#5a8fad',
    accentSoft: 'rgba(122, 168, 196, 0.18)',
    glowA: 'rgba(122, 168, 196, 0.16)',
    glowB: 'rgba(100, 130, 160, 0.10)',
    bg0: '#0b1218',
    bg1: '#121c26',
  },
  Wednesday: {
    day: 'Wednesday',
    label: 'Wednesday',
    mood: 'Forest midweek',
    accent: '#7cb89a',
    accentStrong: '#5fa07d',
    accentSoft: 'rgba(124, 184, 154, 0.16)',
    glowA: 'rgba(124, 184, 154, 0.14)',
    glowB: 'rgba(212, 165, 116, 0.08)',
    bg0: '#0c1411',
    bg1: '#122019',
  },
  Thursday: {
    day: 'Thursday',
    label: 'Thursday',
    mood: 'Warm amber push',
    accent: '#d4a574',
    accentStrong: '#b88752',
    accentSoft: 'rgba(212, 165, 116, 0.18)',
    glowA: 'rgba(212, 165, 116, 0.16)',
    glowB: 'rgba(180, 120, 80, 0.10)',
    bg0: '#14110c',
    bg1: '#1f1a14',
  },
  Friday: {
    day: 'Friday',
    label: 'Friday',
    mood: 'Copper closeout',
    accent: '#c9926e',
    accentStrong: '#b07550',
    accentSoft: 'rgba(201, 146, 110, 0.18)',
    glowA: 'rgba(201, 146, 110, 0.16)',
    glowB: 'rgba(160, 90, 90, 0.08)',
    bg0: '#15100e',
    bg1: '#211815',
  },
  Saturday: {
    day: 'Saturday',
    label: 'Saturday',
    mood: 'Seafoam skill day',
    accent: '#6bc4b0',
    accentStrong: '#4aa994',
    accentSoft: 'rgba(107, 196, 176, 0.18)',
    glowA: 'rgba(107, 196, 176, 0.16)',
    glowB: 'rgba(80, 160, 170, 0.10)',
    bg0: '#0a1514',
    bg1: '#10241f',
  },
  Sunday: {
    day: 'Sunday',
    label: 'Sunday',
    mood: 'Quiet sage recovery',
    accent: '#a8b59a',
    accentStrong: '#8a997c',
    accentSoft: 'rgba(168, 181, 154, 0.18)',
    glowA: 'rgba(168, 181, 154, 0.14)',
    glowB: 'rgba(140, 150, 130, 0.08)',
    bg0: '#10120e',
    bg1: '#181b15',
  },
}

export function themeForDay(day: DayOfWeek): DayTheme {
  return DAY_THEMES[day]
}

/** Apply day theme CSS variables on <html>. */
export function applyDayTheme(day: DayOfWeek): void {
  const t = themeForDay(day)
  const root = document.documentElement
  root.dataset.day = day
  root.style.setProperty('--accent', t.accent)
  root.style.setProperty('--accent-strong', t.accentStrong)
  root.style.setProperty('--accent-soft', t.accentSoft)
  root.style.setProperty('--glow-a', t.glowA)
  root.style.setProperty('--glow-b', t.glowB)
  root.style.setProperty('--bg0', t.bg0)
  root.style.setProperty('--bg1', t.bg1)
  root.style.setProperty('--core', t.accent)
}

export function allDayThemes(): DayTheme[] {
  return DAYS.map((d) => DAY_THEMES[d])
}
