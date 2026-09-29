import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaimMode, type RoomsData } from '../domain/rooms'
import { FIXTURE, FIXTURE_NOW, ME, SE } from '../test/roomsFixture'
import { fakeRooms, renderWithRepos } from '../test/fakes'
import { SignedInApp } from './SignedInApp'

const PROFILE = { userId: ME, displayName: 'Me' }

// The fixture after Priya takes the last space in SE on 29 Oct.
const PRIYA_JOINED: RoomsData = {
  ...FIXTURE,
  claims: [...FIXTURE.claims, { id: 'p', sessionId: `2026-10-29|${SE}`, slot: 2, mode: ClaimMode.Shared, ownerId: 'priya', ownerName: 'Priya' }],
}

// Rooms fake that serves FIXTURE first, then PRIYA_JOINED on every reload.
function roomsThatChange() {
  const loadRooms = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, data: FIXTURE })
    .mockResolvedValue({ ok: true, data: PRIYA_JOINED })
  return fakeRooms(FIXTURE, { loadRooms })
}

function renderLive(rooms = roomsThatChange()) {
  const result = renderWithRepos(<SignedInApp profile={PROFILE} onProfileChange={() => {}} />, { rooms }, '/thursday?week=2026-10-29')
  return { ...result, rooms }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FIXTURE_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('live updates', () => {
  it('shows another host’s claim without a manual refresh', async () => {
    const { rooms } = renderLive()
    const phone = within(await screen.findByRole('region'))
    expect(phone.getByText('Sam · 1 space')).toBeInTheDocument()

    act(() => rooms.emitChange())

    expect(await phone.findByText('Sam · Priya')).toBeInTheDocument()
  })

  it('reloads once for a burst of changes', async () => {
    const { rooms } = renderLive()
    const phone = within(await screen.findByRole('region'))

    act(() => {
      for (let i = 0; i < 11; i++) {
        rooms.emitChange()
      }
    })

    await phone.findByText('Sam · Priya')
    expect(rooms.loadRooms).toHaveBeenCalledTimes(2)
  })

  it('reloads when the page comes back into view', async () => {
    const { rooms } = renderLive()
    const phone = within(await screen.findByRole('region'))

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(await phone.findByText('Sam · Priya')).toBeInTheDocument()
    expect(rooms.loadRooms).toHaveBeenCalledTimes(2)
  })

  it('tells me when the room I’m about to claim is taken', async () => {
    const { rooms } = renderLive()
    const user = userEvent.setup()
    const phone = within(await screen.findByRole('region'))

    await user.click(phone.getByRole('button', { name: /Lister Lab 0\.14/ }))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: `Claim ${SE}` })).toBeInTheDocument()

    act(() => rooms.emitChange())

    // The claim sheet is replaced, so look the dialog up afresh.
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('It’s now: Sam · Priya.'),
    )
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Claim' })).not.toBeInTheDocument()
  })

  it('stops listening after signing out', async () => {
    const rooms = roomsThatChange()
    const { unmount } = renderLive(rooms)
    await screen.findByRole('region')

    unmount()
    rooms.emitChange()
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(rooms.loadRooms).toHaveBeenCalledTimes(1)
  })
})
