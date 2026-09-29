import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaimFailure } from '../domain/claims'
import { ClaimMode, DayType, type RoomsData } from '../domain/rooms'
import { FIXTURE, FIXTURE_NOW, ME, S, SE } from '../test/roomsFixture'
import { fakeClaims, fakeFiles, fakeRooms, renderWithRepos } from '../test/fakes'
import { CLAIM_FAILURE_MESSAGES, QUIET_WARNING } from './messages'
import { SignedInApp } from './SignedInApp'

const PROFILE = { userId: ME, displayName: 'Me' }

function renderRooms(url: string, repos = {}, data: RoomsData = FIXTURE) {
  const rooms = fakeRooms(data)
  const result = renderWithRepos(<SignedInApp profile={PROFILE} onProfileChange={() => {}} />, { rooms, ...repos }, url)
  return { ...result, rooms }
}

// Taps a room in the phone layout by its name.
async function tapRoom(user: ReturnType<typeof userEvent.setup>, room: string) {
  const phone = within(await screen.findByRole('region'))
  await user.click(phone.getByRole('button', { name: new RegExp(room.replace(/[()]/g, '\\$&')) }))
  return within(screen.getByRole('dialog'))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FIXTURE_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('claiming', () => {
  it('claims a shared space, reports it and refreshes the rooms', async () => {
    const claims = fakeClaims()
    const { rooms } = renderRooms('/thursday?week=2026-10-29', { claims })
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)
    expect(sheet.getByRole('heading', { name: `Claim ${SE}` })).toBeInTheDocument()
    await user.click(sheet.getByRole('button', { name: 'Claim' }))

    expect(claims.claimSlot).toHaveBeenCalledWith(`2026-10-29|${SE}`, ClaimMode.Shared)
    expect(screen.getByRole('status')).toHaveTextContent(`Claimed ${SE} on Thu 29 Oct.`)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rooms.loadRooms).toHaveBeenCalledTimes(2)
  })

  it('explains why quiet isn’t possible when someone is in the room', async () => {
    renderRooms('/thursday?week=2026-10-29')
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)

    expect(sheet.getByRole('radio', { name: /Quiet room/ })).toBeDisabled()
    expect(sheet.getByText('Not available: another host is already in this room.')).toBeInTheDocument()
  })

  it('warns before a quiet claim in an empty room', async () => {
    const claims = fakeClaims()
    renderRooms('/monday?week=2026-10-26', { claims })
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)
    await user.click(sheet.getByRole('radio', { name: /Quiet room/ }))

    expect(sheet.getByText(QUIET_WARNING)).toBeInTheDocument()
    await user.click(sheet.getByRole('button', { name: 'Claim' }))
    expect(claims.claimSlot).toHaveBeenCalledWith(`2026-10-26|${SE}`, ClaimMode.Quiet)
    expect(screen.getByRole('status')).toHaveTextContent('as a quiet room')
  })

  it('offers every week for a full-term room and claims the series', async () => {
    const claims = fakeClaims()
    renderRooms('/thursday?week=2026-10-29', { claims })
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)
    await user.click(sheet.getByRole('checkbox', { name: /^Every week \(1 week\)/ }))
    await user.click(sheet.getByRole('button', { name: 'Claim 1 week' }))

    expect(claims.claimSeries).toHaveBeenCalledWith(SE, DayType.Thursday, ClaimMode.Shared)
    expect(screen.getByRole('status')).toHaveTextContent('every week (1 week)')
  })

  it('warns that a part-term room isn’t every week and offers no series', async () => {
    // Only Sam's claims, so S on 22 Oct is open and I have no other room that night.
    const onlySam: RoomsData = { ...FIXTURE, claims: FIXTURE.claims.filter((c) => c.ownerId === 'sam') }
    renderRooms('/thursday?week=2026-10-22', {}, onlySam)
    const user = userEvent.setup()

    const sheet = await tapRoom(user, S)

    expect(sheet.getByText('Not available every week')).toBeInTheDocument()
    expect(sheet.getByText('This room is only booked on: Thu 22 Oct.')).toBeInTheDocument()
    expect(sheet.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('warns when I try to claim a second room on a night I already have one', async () => {
    const withoutAlex: RoomsData = { ...FIXTURE, claims: FIXTURE.claims.filter((c) => c.ownerId !== 'alex') }
    const claims = fakeClaims()
    renderRooms('/thursday?week=2026-10-22', { claims }, withoutAlex)
    const user = userEvent.setup()

    // The card itself stays uncluttered.
    const item = within(await screen.findByRole('region')).getAllByRole('listitem')[1]
    expect(item).toHaveTextContent(`${S}Not every week2 spacesClaim`)

    const sheet = await tapRoom(user, S)
    expect(sheet.getByRole('alert')).toHaveTextContent(`You already have ${SE} on this night.`)
    expect(sheet.queryByRole('button', { name: 'Claim' })).not.toBeInTheDocument()

    await user.click(sheet.getByRole('button', { name: `Go to ${SE}` }))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: `Your claim: ${SE}` })).toBeInTheDocument()
    expect(claims.claimSlot).not.toHaveBeenCalled()
  })

  it('reports weeks taken in the meantime, closes the sheet and refreshes', async () => {
    const claims = fakeClaims({ claimSeries: vi.fn().mockResolvedValue({ ok: false, conflicts: ['2026-10-29'] }) })
    const { rooms } = renderRooms('/thursday?week=2026-10-29', { claims })
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)
    await user.click(sheet.getByRole('checkbox'))
    await user.click(sheet.getByRole('button', { name: /Claim/ }))

    expect(screen.getByRole('alert')).toHaveTextContent('Some weeks were taken in the meantime (Thu 29 Oct)')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rooms.loadRooms).toHaveBeenCalledTimes(2)
  })

  it('reports a room that filled up while the sheet was open', async () => {
    const claims = fakeClaims({ claimSlot: vi.fn().mockResolvedValue({ ok: false, failure: ClaimFailure.RoomFull }) })
    renderRooms('/thursday?week=2026-10-29', { claims })
    const user = userEvent.setup()

    await user.click((await tapRoom(user, SE)).getByRole('button', { name: 'Claim' }))

    expect(screen.getByRole('alert')).toHaveTextContent(CLAIM_FAILURE_MESSAGES[ClaimFailure.RoomFull])
  })

  it('keeps the sheet open with the error when the network fails', async () => {
    const claims = fakeClaims({ claimSlot: vi.fn().mockResolvedValue({ ok: false, failure: ClaimFailure.Network }) })
    renderRooms('/thursday?week=2026-10-29', { claims })
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)
    await user.click(sheet.getByRole('button', { name: 'Claim' }))

    expect(sheet.getByRole('alert')).toHaveTextContent(CLAIM_FAILURE_MESSAGES[ClaimFailure.Network])
  })

  it('closes on Escape without claiming', async () => {
    const claims = fakeClaims()
    renderRooms('/thursday?week=2026-10-29', { claims })
    const user = userEvent.setup()

    await tapRoom(user, SE)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(claims.claimSlot).not.toHaveBeenCalled()
  })

  it('downloads a calendar file after claiming', async () => {
    const files = fakeFiles()
    renderRooms('/thursday?week=2026-10-29', { files })
    const user = userEvent.setup()

    await user.click((await tapRoom(user, SE)).getByRole('button', { name: 'Claim' }))
    await user.click(screen.getByRole('button', { name: 'Add to calendar' }))

    expect(files.save).toHaveBeenCalledWith('sessions.ics', expect.stringContaining(`SUMMARY:Astronomy Society session – ${SE}`), 'text/calendar;charset=utf-8')
  })
})

describe('releasing', () => {
  it('releases this week', async () => {
    const claims = fakeClaims()
    renderRooms('/thursday?week=2026-10-22', { claims })
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)
    expect(sheet.queryByRole('button', { name: /all remaining weeks/ })).not.toBeInTheDocument()
    await user.click(sheet.getByRole('button', { name: 'Release this week' }))

    expect(claims.releaseClaim).toHaveBeenCalledWith(`2026-10-22|${SE}`)
    expect(screen.getByRole('status')).toHaveTextContent(`Released ${SE} on Thu 22 Oct.`)
  })

  it('offers releasing all remaining weeks when several are held', async () => {
    const twoWeeks: RoomsData = {
      ...FIXTURE,
      claims: [...FIXTURE.claims, { id: 'x', sessionId: `2026-10-29|${SE}`, slot: 2, mode: ClaimMode.Shared, ownerId: ME, ownerName: 'Me' }],
    }
    const claims = fakeClaims()
    renderRooms('/thursday?week=2026-10-22', { claims }, twoWeeks)
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)
    await user.click(sheet.getByRole('button', { name: 'Release all remaining weeks (2)' }))

    expect(claims.releaseSeries).toHaveBeenCalledWith(SE, DayType.Thursday)
  })

  it('opens release from Your sessions', async () => {
    renderRooms('/monday')
    const user = userEvent.setup()

    await user.click(await screen.findByText('Your sessions (1)'))
    await user.click(screen.getByRole('button', { name: `Release ${SE} on Thu 22 Oct` }))

    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: `Your claim: ${SE}` })).toBeInTheDocument()
  })

  it('has no action on full, quiet or past rooms', async () => {
    renderRooms('/monday?week=2026-10-19')
    const phone = within(await screen.findByRole('region'))
    expect(phone.queryAllByRole('button', { name: new RegExp(SE.replace(/[()]/g, '\\$&')) })).toHaveLength(0)
  })
})
