import { useState, type FormEvent } from 'react'
import { DISPLAY_NAME_MAX_LENGTH, checkDisplayName } from '../domain/displayName'
import type { Profile, ProfileResult } from '../domain/profile'
import { DISPLAY_NAME_MESSAGES, PROFILE_FAILURE_MESSAGES } from './messages'
import { ErrorText, inputClass, linkButtonClass, primaryButtonClass } from './Screen'

type DisplayNameFormProps = {
  initialName?: string
  submitLabel: string
  save: (name: string) => Promise<ProfileResult>
  onSaved: (profile: Profile) => void
  onCancel?: () => void
}

// Name input with validation and save errors, shared by first sign-in and "Change name".
export function DisplayNameForm({ initialName = '', submitLabel, save, onSaved, onCancel }: DisplayNameFormProps) {
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const check = checkDisplayName(name)

    if (!check.ok) {
      setError(DISPLAY_NAME_MESSAGES[check.problem])
      return
    }

    setBusy(true)
    setError(null)
    const result = await save(check.name)
    setBusy(false)

    if (!result.ok) {
      setError(PROFILE_FAILURE_MESSAGES[result.failure])
      return
    }

    if (result.profile) {
      onSaved(result.profile)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="display-name" className="mb-2 block font-medium">
        Display name
      </label>
      <input
        id="display-name"
        type="text"
        autoComplete="nickname"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        className={inputClass}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <p className="mt-2 text-sm text-muted">
        Shown to other hosts on the rooms you claim. Your email is never shown.
      </p>
      <ErrorText message={error} />
      <button type="submit" className={primaryButtonClass} disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>
      {onCancel && (
        <button type="button" className={`${linkButtonClass} mt-3`} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      )}
    </form>
  )
}
