import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

const HINT_KEY = 'forge-header-hints-seen-v1'

export function HeaderIconButton({
  label,
  active,
  onClick,
  to,
  children,
  showHint,
  onHintSeen,
}: {
  label: string
  active?: boolean
  onClick?: () => void
  to?: string
  children: ReactNode
  showHint?: boolean
  onHintSeen?: () => void
}) {
  const className = `icon-btn${active ? ' on' : ''}`
  const inner = (
    <>
      {children}
      <span className="icon-btn-label">{label}</span>
      {showHint && <span className="icon-hint">{label}</span>}
    </>
  )

  useEffect(() => {
    if (!showHint || !onHintSeen) return
    const t = window.setTimeout(onHintSeen, 4500)
    return () => clearTimeout(t)
  }, [showHint, onHintSeen])

  if (to) {
    return (
      <Link
        to={to}
        className={className}
        aria-label={label}
        title={label}
        onClick={onHintSeen}
      >
        {inner}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onClick={() => {
        onHintSeen?.()
        onClick?.()
      }}
    >
      {inner}
    </button>
  )
}

export function useHeaderHints(): [boolean, () => void] {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) !== '1'
    } catch {
      return true
    }
  })

  function dismiss() {
    try {
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      /* ignore */
    }
    setShow(false)
  }

  return [show, dismiss]
}
