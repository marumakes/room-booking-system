import { describe, expect, it } from 'vitest'
import { ClaimAction } from '../domain/history'
import { ClaimMode } from '../domain/rooms'
import { FIXTURE, S, SE } from '../test/roomsFixture'
import { exportTables } from './exportSheets'

describe('exportTables', () => {
  const [monday, thursday, claims, history] = exportTables(FIXTURE, [
    {
      id: 1,
      occurredAt: '2026-10-19T09:05:00Z',
      action: ClaimAction.Claimed,
      sessionDate: '2026-10-22',
      room: SE,
      mode: ClaimMode.Shared,
      ownerName: 'Sam',
      actorName: 'Sam',
    },
  ])

  it('has a Monday, Thursday, Claims and History tab', () => {
    expect([monday, thursday, claims, history].map((t) => t.name)).toEqual(['Monday', 'Thursday', 'Claims', 'History'])
  })

  it('grids each day as weeks × rooms, in room order', () => {
    expect(thursday.header).toEqual(['Week', SE, S])
    expect(thursday.rows).toEqual([
      [{ date: '2026-10-15' }, '', 'Not booked'],
      [{ date: '2026-10-22' }, 'Me, Sam', 'Alex (quiet room)'],
      [{ date: '2026-10-29' }, 'Sam', 'Not booked'],
    ])
    expect(thursday.widths).toHaveLength(thursday.header.length)
  })

  it('marks cancelled weeks as not booked', () => {
    expect(monday.rows.at(-1)).toEqual([{ date: '2026-11-02' }, 'Not booked'])
  })

  it('lists each claim once, quiet rooms included, by date then room', () => {
    expect(claims.header).toEqual(['Date', 'Day', 'Room', 'Host', 'Type'])
    expect(claims.rows).toEqual([
      [{ date: '2026-10-19' }, 'Monday', SE, 'Sam', 'Shared'],
      [{ date: '2026-10-22' }, 'Thursday', SE, 'Me', 'Shared'],
      [{ date: '2026-10-22' }, 'Thursday', SE, 'Sam', 'Shared'],
      [{ date: '2026-10-22' }, 'Thursday', S, 'Alex', 'Quiet room'],
      [{ date: '2026-10-29' }, 'Thursday', SE, 'Sam', 'Shared'],
    ])
  })

  it('writes history times in London time', () => {
    expect(history.rows).toEqual([[{ londonTime: '2026-10-19T10:05' }, 'Sam claimed', SE, { date: '2026-10-22' }]])
  })
})
