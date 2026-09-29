import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Profile } from '../domain/profile'
import { useRepos } from './repos'
import { ThemeSelect } from './ThemeSelect'

const itemClass = 'flex w-full items-center rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition hover:bg-sunk'

type AccountMenuProps = {
  profile: Profile
  committee: boolean
  onChangeName: () => void
  onHowItWorks: () => void
}

// The signed-in user's initial and name; opens a small card with name, history, theme and sign out.
// The card is hidden rather than removed when closed, so the theme keeps following the device.
// Escape or a click outside closes it.
export function AccountMenu({ profile, committee, onChangeName, onHowItWorks }: AccountMenuProps) {
  const { auth } = useRepos()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function changeName() {
    setOpen(false)
    onChangeName()
  }

  function howItWorks() {
    setOpen(false)
    onHowItWorks()
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm font-medium shadow-card transition hover:bg-sunk"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${profile.displayName}, account menu`}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-accent text-on-primary uppercase">
          {profile.displayName.charAt(0)}
        </span>
        <span aria-hidden="true" className="hidden max-w-[10rem] truncate sm:inline">
          {profile.displayName}
        </span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <div
        id={menuId}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 w-72 rounded-3xl border border-line bg-surface p-2 shadow-card"
      >
        <div className="px-3 pt-2 pb-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Signed in as</p>
          <p className="mt-0.5 truncate font-semibold">{profile.displayName}</p>
        </div>
        <button type="button" className={itemClass} onClick={changeName}>
          Change name
        </button>
        <button type="button" className={itemClass} onClick={howItWorks}>
          How it works
        </button>
        {committee && (
          <Link to="/history" className={itemClass} onClick={() => setOpen(false)}>
            Claim history
          </Link>
        )}
        <div className="px-3 py-3">
          <ThemeSelect />
        </div>
        <div className="mx-3 border-t border-line" />
        <button type="button" className={`${itemClass} mt-1 text-danger-ink`} onClick={() => void auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
