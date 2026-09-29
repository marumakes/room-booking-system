// Matches the database check on profiles.display_name.
export const DISPLAY_NAME_MAX_LENGTH = 40

export const DisplayNameProblem = {
  Empty: 'empty',
  TooLong: 'too_long',
} as const
export type DisplayNameProblem = (typeof DisplayNameProblem)[keyof typeof DisplayNameProblem]

export type DisplayNameCheck =
  | { ok: true; name: string }
  | { ok: false; problem: DisplayNameProblem }

// Trims the name and checks it fits the database rule.
export function checkDisplayName(raw: string): DisplayNameCheck {
  const name = raw.trim()

  if (name.length === 0) {
    return { ok: false, problem: DisplayNameProblem.Empty }
  }

  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, problem: DisplayNameProblem.TooLong }
  }

  return { ok: true, name }
}
