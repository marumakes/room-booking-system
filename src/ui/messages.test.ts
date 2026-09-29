import { describe, expect, it } from 'vitest'
import { CellKind, ClaimMode, type CellView } from '../domain/rooms'
import { cellText } from './messages'

describe('cellText', () => {
  const cases: [CellView, string][] = [
    [{ kind: CellKind.NotBooked }, 'Not booked'],
    [{ kind: CellKind.Open, spacesLeft: 2, others: [], past: false, mineTonight: null }, '2 spaces'],
    [{ kind: CellKind.Open, spacesLeft: 1, others: ['Sam'], past: false, mineTonight: null }, 'Sam · 1 space'],
    [{ kind: CellKind.Mine, mode: ClaimMode.Shared, others: ['Sam'], past: false }, 'You · Sam'],
    [{ kind: CellKind.Mine, mode: ClaimMode.Shared, others: [], past: false }, 'You · 1 space left'],
    [{ kind: CellKind.Mine, mode: ClaimMode.Quiet, others: [], past: false }, 'You (quiet room)'],
    [{ kind: CellKind.Full, names: ['Alex', 'Sam'], past: false }, 'Alex · Sam'],
    [{ kind: CellKind.Quiet, name: 'Alex', past: false }, 'Alex (quiet room)'],
  ]

  it.each(cases)('%o → %s', (view, text) => {
    expect(cellText(view)).toBe(text)
  })
})
