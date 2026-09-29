import { useEffect, useId, useRef, type ReactNode } from 'react'

type SheetProps = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Modal panel: slides up from the bottom on phones, centred on wider screens.
// Escape or the backdrop closes it; focus moves in on open, Tab stays inside, and focus returns on close.
export function Sheet({ title, subtitle, onClose, children }: SheetProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  // Latest onClose, so the effect below runs once per opening rather than on every parent render.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }

      if (event.key === 'Tab') {
        trapTab(event)
      }
    }

    // Wraps Tab from the last control to the first (and Shift+Tab the other way), so keyboard
    // users can't wander into the page behind the sheet.
    function trapTab(event: KeyboardEvent) {
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (el) => !el.hasAttribute('disabled'),
      )

      if (controls.length === 0) {
        return
      }

      const first = controls[0]
      const last = controls[controls.length - 1]
      const active = document.activeElement
      const outside = !panel.current?.contains(active)

      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault()
        last.focus()
        return
      }

      if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-surface px-6 pt-3 pb-8 text-left text-base text-ink shadow-card md:rounded-[2rem] md:pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle, as on iOS sheets. Decorative. The panel sets its own text styles, so a sheet
            opened from inside e.g. the centred footer looks the same as any other. */}
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-track md:hidden" />
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button type="button" className="grid size-9 shrink-0 place-items-center rounded-full bg-sunk text-ink transition hover:bg-track"
            onClick={onClose}
            aria-label="Close">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
