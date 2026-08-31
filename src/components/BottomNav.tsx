import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Today', icon: TodayIcon },
  { to: '/plan', label: 'Plan', icon: PlanIcon },
  { to: '/workout', label: 'Workout', icon: WorkoutIcon },
  { to: '/recipes', label: 'Recipes', icon: RecipesIcon },
  { to: '/progress', label: 'Progress', icon: ProgressIcon },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <t.icon />
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

function PlanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

function WorkoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 7v10M18 7v10M3 10v4M21 10v4M9 8v8h6V8" />
    </svg>
  )
}

function RecipesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5a2 2 0 0 1 2-2h11v18H6a2 2 0 0 0-2 2V5z" />
      <path d="M17 3v18M8 7h5M8 11h5" />
    </svg>
  )
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" />
    </svg>
  )
}
