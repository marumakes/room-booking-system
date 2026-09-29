import { NavLink } from 'react-router'
import type { DayType } from '../domain/rooms'
import { DAY_LABELS } from './messages'

type DayTabsProps = {
  // Days with sessions, e.g. Tuesday and Friday.
  days: DayType[]
}

// Day switch, drawn as an iOS-style segmented control. Hidden when there's only one session day.
// Links, so each day has its own shareable URL.
export function DayTabs({ days }: DayTabsProps) {
  if (days.length < 2) {
    return null
  }

  return (
    <nav aria-label="Session day" className="inline-flex gap-1 rounded-full bg-track p-1">
      {days.map((day) => (
        <NavLink
          key={day}
          to={`/${day}`}
          className={({ isActive }) =>
            `rounded-full px-5 py-2 text-sm font-medium transition ${
              isActive ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
            }`
          }
        >
          {DAY_LABELS[day]}
        </NavLink>
      ))}
    </nav>
  )
}
