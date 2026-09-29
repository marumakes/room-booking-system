import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaimFailure } from '../domain/claims'
import { ClaimAction, type HistoryEntry } from '../domain/history'
import { ViewerRole } from '../domain/profile'
import { ClaimMode } from '../domain/rooms'
import { FIXTURE, FIXTURE_NOW, ME, S, SE } from '../test/roomsFixture'
import { fakeClaims, fakeHistory, fakeProfiles, fakeRooms, renderWithRepos } from '../test/fakes'
import { CLAIM_FAILURE_MESSAGES } from './messages'
import { SignedInApp } from './SignedInApp'

const PROFILE = { userId: ME, displayName: 'Me' }

function renderAs(role: ViewerRole, url: string, repos = {}) {
  const profiles = fakeProfiles({ getRole: vi.fn().mockResolvedValue(role) })
  return renderWithRepos(
    <SignedInApp profile={PROFILE} onProfileChange={() => {}} />,
    { rooms: fakeRooms(FIXTURE), profiles, ...repos },
    url,
  )
}

function location() {
  return screen.getByTestId('location').textContent
}

// The phone layout's entry for a room.
async function roomItem(room: string) {
  const phone = within(await screen.findByRole('region'))
  return phone.getAllByRole('listitem').find((li) => li.textContent?.startsWith(room))!
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FIXTURE_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('committee clear', () => {
  it('lets committee clear a quiet room after confirming', async () => {
    const claims = fakeClaims()
    renderAs(ViewerRole.Committee, '/thursday?week=2026-10-22', { claims })
    const user = userEvent.setup()

    await user.click(await within(await roomItem(S)).findByRole('button'))
    const sheet = within(screen.getByRole('dialog'))
    expect(sheet.getByText('Alex (quiet room)', { selector: 'p' })).toBeInTheDocument()

    await user.click(sheet.getByRole('button', { name: 'Clear Alex’s claim' }))
    expect(claims.clearClaim).not.toHaveBeenCalled()
    await user.click(sheet.getByRole('button', { name: 'Yes, clear it' }))

    expect(claims.clearClaim).toHaveBeenCalledWith(`2026-10-22|${S}`, 'alex')
    expect(screen.getByRole('status')).toHaveTextContent(`Cleared Alex’s claim on ${S}, Thu 22 Oct.`)
  })

  it('offers clearing alongside claiming in a room with space', async () => {
    renderAs(ViewerRole.Committee, '/thursday?week=2026-10-29')
    const user = userEvent.setup()

    await user.click(within(await roomItem(SE)).getByRole('button'))
    const sheet = within(screen.getByRole('dialog'))

    expect(sheet.getByRole('button', { name: 'Claim' })).toBeInTheDocument()
    expect(await sheet.findByRole('button', { name: 'Clear Sam’s claim' })).toBeInTheDocument()
  })

  it('offers clearing a roommate alongside releasing my own claim', async () => {
    renderAs(ViewerRole.Committee, '/thursday?week=2026-10-22')
    const user = userEvent.setup()

    await user.click(within(await roomItem(SE)).getByRole('button'))
    const sheet = within(screen.getByRole('dialog'))

    expect(sheet.getByRole('button', { name: 'Release this week' })).toBeInTheDocument()
    expect(await sheet.findByRole('button', { name: 'Clear Sam’s claim' })).toBeInTheDocument()
    expect(sheet.queryByRole('button', { name: 'Clear Me’s claim' })).not.toBeInTheDocument()
  })

  it('cancelling the confirmation clears nothing', async () => {
    const claims = fakeClaims()
    renderAs(ViewerRole.Committee, '/thursday?week=2026-10-22', { claims })
    const user = userEvent.setup()

    await user.click(await within(await roomItem(S)).findByRole('button'))
    const sheet = within(screen.getByRole('dialog'))
    await user.click(sheet.getByRole('button', { name: 'Clear Alex’s claim' }))
    await user.click(sheet.getByRole('button', { name: 'Cancel' }))

    expect(sheet.getByRole('button', { name: 'Clear Alex’s claim' })).toBeInTheDocument()
    expect(claims.clearClaim).not.toHaveBeenCalled()
  })

  it('shows the reason if the server refuses', async () => {
    const claims = fakeClaims({ clearClaim: vi.fn().mockResolvedValue({ ok: false, failure: ClaimFailure.NotCommittee }) })
    renderAs(ViewerRole.Committee, '/thursday?week=2026-10-22', { claims })
    const user = userEvent.setup()

    await user.click(await within(await roomItem(S)).findByRole('button'))
    const sheet = within(screen.getByRole('dialog'))
    await user.click(sheet.getByRole('button', { name: 'Clear Alex’s claim' }))
    await user.click(sheet.getByRole('button', { name: 'Yes, clear it' }))

    expect(sheet.getByRole('alert')).toHaveTextContent(CLAIM_FAILURE_MESSAGES[ClaimFailure.NotCommittee])
  })

  it('gives hosts no way to touch other people’s rooms', async () => {
    renderAs(ViewerRole.Host, '/thursday?week=2026-10-22')
    const item = await roomItem(S)

    expect(within(item).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('claim history', () => {
  const ENTRIES: HistoryEntry[] = [
    {
      id: 2,
      occurredAt: '2026-10-20T17:42:00Z',
      action: ClaimAction.Cleared,
      sessionDate: '2026-10-22',
      room: S,
      mode: ClaimMode.Quiet,
      ownerName: 'Alex',
      actorName: 'Cora',
    },
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
  ]

  it('shows committee a link and the history, newest first, in London time', async () => {
    renderAs(ViewerRole.Committee, '/thursday', { history: fakeHistory(ENTRIES) })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Me, account menu' }))
    await user.click(screen.getByRole('link', { name: 'Claim history' }))
    const table = within(await screen.findByRole('table', { name: 'Claim history, newest first' }))
    const rows = table.getAllByRole('row').slice(1).map((r) => r.textContent)

    expect(location()).toBe('/history')
    expect(rows).toEqual([
      `Tue 20 Oct, 18:42Cora cleared Alex’s claim (quiet room)${S}Thu 22 Oct`,
      `Mon 19 Oct, 10:05Sam claimed${SE}Thu 22 Oct`,
    ])
  })

  it('hides the link from hosts and sends them back from /history', async () => {
    renderAs(ViewerRole.Host, '/history')

    await screen.findByRole('region')
    expect(location()).toBe('/thursday')
    expect(screen.queryByRole('link', { name: 'Claim history' })).not.toBeInTheDocument()
  })
})
