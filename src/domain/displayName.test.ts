import { describe, expect, it } from 'vitest'
import { DISPLAY_NAME_MAX_LENGTH, DisplayNameProblem, checkDisplayName } from './displayName'

describe('checkDisplayName', () => {
  it('trims surrounding space', () => {
    expect(checkDisplayName('  Alex  ')).toEqual({ ok: true, name: 'Alex' })
  })

  it('rejects blank names', () => {
    expect(checkDisplayName('   ')).toEqual({ ok: false, problem: DisplayNameProblem.Empty })
  })

  it('accepts exactly the maximum length', () => {
    const name = 'a'.repeat(DISPLAY_NAME_MAX_LENGTH)
    expect(checkDisplayName(name)).toEqual({ ok: true, name })
  })

  it('rejects one over the maximum', () => {
    expect(checkDisplayName('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      problem: DisplayNameProblem.TooLong,
    })
  })
})
