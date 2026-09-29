// Only addresses at the site's email domain can sign in. The database enforces the same rule.
import { SITE } from '../config'

// Trimmed and lower-cased, so " A.Student@University.example " and "a.student@university.example" are the same account.
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

// True only for exactly name@<SITE.emailDomain>; subdomains and lookalikes are rejected.
export function isAllowedEmail(email: string): boolean {
  const parts = normaliseEmail(email).split('@')

  if (parts.length !== 2) {
    return false
  }

  const [local, domain] = parts
  return local.length > 0 && domain === SITE.emailDomain
}
