import { useEffect, useState, type FormEvent } from 'react'
import { SITE } from '../config'
import { RESEND_COOLDOWN_SECONDS, SIGN_IN_CODE_LENGTH } from '../domain/auth'
import { isAllowedEmail } from '../domain/email'
import { AUTH_FAILURE_MESSAGES, NOT_ALLOWED_EMAIL_MESSAGE } from './messages'
import { useRepos } from './repos'
import { ErrorText, Screen, inputClass, linkButtonClass, primaryButtonClass, warningClass } from './Screen'

const OUTLOOK_QUARANTINE_URL = 'https://security.microsoft.com/quarantine'
const ONE_SECOND_MS = 1000

const Step = {
  Email: 'email',
  Code: 'code',
} as const
type Step = (typeof Step)[keyof typeof Step]

// Two steps: enter a university email, then the 6-digit code emailed to it.
export function SignInPage() {
  const { auth } = useRepos()
  const [step, setStep] = useState<Step>(Step.Email)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // Counts the resend lock down to zero, one second at a time.
  useEffect(() => {
    if (cooldown <= 0) {
      return
    }

    const timer = setTimeout(() => setCooldown((s) => s - 1), ONE_SECOND_MS)
    return () => clearTimeout(timer)
  }, [cooldown])

  // Sends a code; on success moves to the code step and locks resending.
  async function sendCode() {
    setBusy(true)
    setError(null)
    const result = await auth.requestCode(email)
    setBusy(false)

    if (!result.ok) {
      setError(AUTH_FAILURE_MESSAGES[result.failure])
      return
    }

    setCode('')
    setStep(Step.Code)
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  function onEmailSubmit(event: FormEvent) {
    event.preventDefault()

    if (!isAllowedEmail(email)) {
      setError(NOT_ALLOWED_EMAIL_MESSAGE)
      return
    }

    void sendCode()
  }

  // For someone who reloaded the page but still has a code in their inbox.
  function enterExistingCode() {
    if (!isAllowedEmail(email)) {
      setError(NOT_ALLOWED_EMAIL_MESSAGE)
      return
    }

    setError(null)
    setCode('')
    setStep(Step.Code)
  }

  // Signing in succeeds silently: the auth listener in App swaps the screen.
  async function verify(fullCode: string) {
    setBusy(true)
    setError(null)
    const result = await auth.verifyCode(email, fullCode)
    setBusy(false)

    if (!result.ok) {
      setError(AUTH_FAILURE_MESSAGES[result.failure])
      setCode('')
    }
  }

  // Keeps digits only (so a pasted "123 456" works) and submits once the code is complete.
  function onCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, SIGN_IN_CODE_LENGTH)
    setCode(digits)

    if (digits.length === SIGN_IN_CODE_LENGTH && !busy) {
      void verify(digits)
    }
  }

  function onCodeSubmit(event: FormEvent) {
    event.preventDefault()

    if (code.length === SIGN_IN_CODE_LENGTH) {
      void verify(code)
    }
  }

  function changeEmail() {
    setStep(Step.Email)
    setCode('')
    setError(null)
  }

  if (step === Step.Email) {
    return (
      <Screen title="Sign in">
        <form onSubmit={onEmailSubmit} noValidate>
          <label htmlFor="email" className="mb-2 block font-medium">
            {SITE.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={SITE.emailExample}
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="mt-2 text-sm text-muted">We’ll email you a 6-digit code. No password needed.</p>
          <ErrorText message={error} />
          <button type="submit" className={primaryButtonClass} disabled={busy}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
        <button type="button" className={`${linkButtonClass} mt-5 block`} onClick={enterExistingCode}>
          I already have a code
        </button>
      </Screen>
    )
  }

  return (
    <Screen title="Enter your code">
      <p className="mb-4">
        We sent a 6-digit code to <strong className="break-all">{email.trim()}</strong>.
      </p>
      <form onSubmit={onCodeSubmit} noValidate>
        <label htmlFor="code" className="mb-2 block font-medium">
          6-digit code
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
          value={code}
          disabled={busy}
          onChange={(e) => onCodeChange(e.target.value)}
        />
        <ErrorText message={error} />
        <button type="submit" className={primaryButtonClass} disabled={busy || code.length !== SIGN_IN_CODE_LENGTH}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>

      <div className={`mt-6 ${warningClass}`}>
        <p className="font-medium">Can’t find the email?</p>
        <p className="mt-1">
          Check your Junk folder, then your{' '}
          <a href={OUTLOOK_QUARANTINE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Outlook quarantine
          </a>
          . Mark it “Not junk” so the next one arrives normally.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-4">
        <button type="button" className={linkButtonClass} onClick={() => void sendCode()} disabled={busy || cooldown > 0}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
        <button type="button" className={linkButtonClass} onClick={changeEmail} disabled={busy}>
          Use a different email
        </button>
      </div>
    </Screen>
  )
}
