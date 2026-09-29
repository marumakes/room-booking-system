import { useState, type ReactNode } from 'react'
import { Brand } from './Brand'
import { BrandSize } from './brandSize'
import { HELP_TEXT } from './messages'
import { PrivacyNote } from './PrivacyNote'

type ScreenProps = {
  title: string
  subtitle?: string
  children: ReactNode
}

// Centred card used by the sign-in screens.
export function Screen({ title, subtitle, children }: ScreenProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Brand size={BrandSize.Large} />
      <div className={`${cardClass} mt-8`}>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      <HelpFooter />
    </main>
  )
}

// Who to ask for help, and the privacy note, on every screen.
export function HelpFooter() {
  const [showPrivacy, setShowPrivacy] = useState(false)

  return (
    <footer className="mx-auto mt-10 max-w-7xl px-4 pb-8 text-center text-sm text-muted">
      <p>{HELP_TEXT}</p>
      <button type="button" className={`${linkButtonClass} mt-2`} onClick={() => setShowPrivacy(true)}>
        Privacy: what we store
      </button>
      {showPrivacy && <PrivacyNote onClose={() => setShowPrivacy(false)} />}
    </footer>
  )
}

type ErrorTextProps = {
  message: string | null
}

// Inline error under a form; announced by screen readers when it appears.
export function ErrorText({ message }: ErrorTextProps) {
  if (!message) {
    return null
  }

  return (
    <p role="alert" className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">
      {message}
    </p>
  )
}

// A white rounded panel on the grey page: the main building block of every screen.
export const cardClass = 'rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6'

// Small grey label above a value, e.g. "WEEK 1 OF 11".
export const eyebrowClass = 'text-xs font-medium uppercase tracking-wider text-muted'

// Soft tinted notes: a warning to read before acting.
export const warningClass = 'rounded-2xl bg-warn-soft p-4 text-sm text-warn-ink'

export const inputClass =
  'w-full rounded-2xl border border-line-strong bg-surface px-4 py-3 text-base outline-none transition focus:border-ink focus:ring-4 focus:ring-focus/20'

export const primaryButtonClass =
  'mt-5 w-full rounded-full bg-primary px-5 py-3 font-medium text-on-primary transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50'

export const secondaryButtonClass =
  'mt-3 w-full rounded-full bg-sunk px-5 py-3 font-medium text-ink transition hover:bg-track disabled:cursor-not-allowed disabled:opacity-50'

// Small grey pill for actions beside content, e.g. "Download spreadsheet".
export const pillButtonClass =
  'inline-flex items-center rounded-full bg-sunk px-3.5 py-1.5 text-sm font-medium text-ink transition hover:bg-track disabled:cursor-not-allowed disabled:opacity-50'

export const dangerButtonClass =
  'rounded-full bg-danger px-4 py-2 text-sm font-medium text-on-danger transition hover:bg-danger-hover disabled:opacity-50'

// Round icon-only button, e.g. the sheet's close and the week arrows.
export const iconButtonClass =
  'grid size-10 shrink-0 place-items-center rounded-full bg-sunk text-ink transition hover:bg-track disabled:cursor-not-allowed disabled:opacity-40'

export const linkButtonClass =
  'text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 transition hover:decoration-ink disabled:cursor-not-allowed disabled:text-muted disabled:no-underline'

// A checkbox drawn as an iOS-style switch; still a native checkbox for keyboards and screen readers.
export const switchClass =
  "relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-track ring-1 ring-line-strong transition ring-inset checked:ring-accent before:absolute before:top-0.5 before:left-0.5 before:size-6 before:rounded-full before:bg-white before:shadow before:transition checked:bg-accent checked:before:translate-x-5"
