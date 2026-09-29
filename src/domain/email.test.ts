import { describe, expect, it } from 'vitest'
import { isAllowedEmail, normaliseEmail } from './email'

describe('isAllowedEmail', () => {
  it.each(['a.student@university.example', 'first.last@university.example', '  A.Student@UNIVERSITY.EXAMPLE  '])('accepts %s', (email) => {
    expect(isAllowedEmail(email)).toBe(true)
  })

  it.each([
    'someone@gmail.com',
    'x@university.example.evil.com',
    'x@student.university.example',
    'x@eviluniversity.example',
    '@university.example',
    'a@b@university.example',
    'university.example',
    '',
  ])('rejects %j', (email) => {
    expect(isAllowedEmail(email)).toBe(false)
  })
})

describe('normaliseEmail', () => {
  it('trims and lower-cases', () => {
    expect(normaliseEmail('  A.Stu@University.example ')).toBe('a.stu@university.example')
  })
})
