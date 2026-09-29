import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaimFailure } from '../domain/claims'
import { DataFailure } from '../domain/failure'
import { ViewerRole } from '../domain/profile'
import { XLSX_MIME_TYPE } from '../domain/spreadsheet'
import { FIXTURE, FIXTURE_NOW, ME, S, SE } from '../test/roomsFixture'
import { fakeClaims, fakeFiles, fakeProfiles, fakeRooms, fakeSpreadsheets, renderWithRepos } from '../test/fakes'
import { CLAIM_FAILURE_MESSAGES, DATA_FAILURE_MESSAGES } from './messages'
import { SignedInApp } from './SignedInApp'

const PROFILE = { userId: ME, displayName: 'Me' }

// FIXTURE_NOW is Tue 20 Oct, 13:00 London time.
const CLOSED = { ...FIXTURE, closesAt: '2026-10-20T11:00:00Z' }
const CLOSING_SOON = { ...FIXTURE, closesAt: '2026-10-22T17:00:00Z' }

function renderAs(role: ViewerRole, data = FIXTURE, repos = {}, url = '/thursday?week=2026-10-22') {
  const profiles = fakeProfiles({ getRole: vi.fn().mockResolvedValue(role) })
  return renderWithRepos(
    <SignedInApp profile={PROFILE} onProfileChange={() => {}} />,
    { rooms: fakeRooms(data), profiles, ...repos },
    url,
  )
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

describe('closing time for hosts', () => {
  it('shows nothing when no closing time is set', async () => {
    renderAs(ViewerRole.Host)

    await screen.findByRole('region')
    expect(screen.queryByText(/Sign-up clos/)).not.toBeInTheDocument()
  })

  it('shows when sign-up closes, in London time', async () => {
    renderAs(ViewerRole.Host, CLOSING_SOON)

    expect(await screen.findByText('Sign-up closes Thu 22 Oct, 18:00.')).toBeInTheDocument()
  })

  it('after closing, explains instead of offering to claim', async () => {
    const claims = fakeClaims()
    renderAs(ViewerRole.Host, CLOSED, { claims }, '/thursday?week=2026-10-29')
    const user = userEvent.setup()

    expect(await screen.findByText(/Sign-up closed Tue 20 Oct, 12:00\. Speak to the committee/)).toBeInTheDocument()
    const sheet = await tapRoom(user, SE)

    expect(sheet.getByRole('alert')).toHaveTextContent(CLAIM_FAILURE_MESSAGES[ClaimFailure.ClaimsClosed])
    expect(sheet.queryByRole('button', { name: 'Claim' })).not.toBeInTheDocument()
  })

  it('after closing, explains instead of offering to release', async () => {
    renderAs(ViewerRole.Host, CLOSED)
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)

    expect(sheet.getByRole('alert')).toHaveTextContent(CLAIM_FAILURE_MESSAGES[ClaimFailure.ClaimsClosed])
    expect(sheet.queryByRole('button', { name: 'Release this week' })).not.toBeInTheDocument()
  })

  it('closes the sheet and refreshes if the server says sign-up has closed', async () => {
    const claims = fakeClaims({ claimSlot: vi.fn().mockResolvedValue({ ok: false, failure: ClaimFailure.ClaimsClosed }) })
    const rooms = fakeRooms(FIXTURE)
    renderAs(ViewerRole.Host, FIXTURE, { claims, rooms }, '/thursday?week=2026-10-29')
    const user = userEvent.setup()

    const sheet = await tapRoom(user, SE)
    await user.click(sheet.getByRole('button', { name: 'Claim' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(CLAIM_FAILURE_MESSAGES[ClaimFailure.ClaimsClosed])
    expect(rooms.loadRooms).toHaveBeenCalledTimes(2)
  })

  it('gives hosts no closing-time or export controls', async () => {
    renderAs(ViewerRole.Host, CLOSING_SOON)

    await screen.findByText('Sign-up closes Thu 22 Oct, 18:00.')
    expect(screen.queryByRole('button', { name: /closing time/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download spreadsheet' })).not.toBeInTheDocument()
  })
})

describe('closing time for committee', () => {
  it('sets a closing time entered in London time', async () => {
    const claims = fakeClaims()
    renderAs(ViewerRole.Committee, FIXTURE, { claims })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Set closing time' }))
    fireEvent.change(screen.getByLabelText('Closing time (London time)'), { target: { value: '2026-10-22T18:00' } })
    await user.click(screen.getByRole('button', { name: 'Save closing time' }))

    expect(claims.setClosingTime).toHaveBeenCalledWith('2026-10-22T17:00:00.000Z')
    expect(screen.getByRole('status')).toHaveTextContent('Sign-up closes Thu 22 Oct, 18:00.')
  })

  it('asks for a time before saving', async () => {
    const claims = fakeClaims()
    renderAs(ViewerRole.Committee, FIXTURE, { claims })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Set closing time' }))
    await user.click(screen.getByRole('button', { name: 'Save closing time' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a date and time.')
    expect(claims.setClosingTime).not.toHaveBeenCalled()
  })

  it('shows the current time when changing it, and can remove it', async () => {
    const claims = fakeClaims()
    renderAs(ViewerRole.Committee, CLOSING_SOON, { claims })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Change closing time' }))
    expect(screen.getByLabelText('Closing time (London time)')).toHaveValue('2026-10-22T18:00')
    await user.click(screen.getByRole('button', { name: 'Remove closing time' }))

    expect(claims.setClosingTime).toHaveBeenCalledWith(null)
    expect(screen.getByRole('status')).toHaveTextContent('Closing time removed. Sign-up is open.')
  })

  it('shows the reason if the server refuses', async () => {
    const claims = fakeClaims({ setClosingTime: vi.fn().mockResolvedValue({ ok: false, failure: ClaimFailure.NotCommittee }) })
    renderAs(ViewerRole.Committee, CLOSING_SOON, { claims })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Change closing time' }))
    await user.click(screen.getByRole('button', { name: 'Save closing time' }))

    expect(screen.getByRole('alert')).toHaveTextContent(CLAIM_FAILURE_MESSAGES[ClaimFailure.NotCommittee])
  })

  it('can still clear claims after closing', async () => {
    renderAs(ViewerRole.Committee, CLOSED)
    const user = userEvent.setup()

    const sheet = await tapRoom(user, S)

    expect(await sheet.findByRole('button', { name: 'Clear Alex’s claim' })).toBeInTheDocument()
  })
})

describe('export', () => {
  it('downloads the spreadsheet and warns that sign-up is still open', async () => {
    const files = fakeFiles()
    const spreadsheets = fakeSpreadsheets()
    renderAs(ViewerRole.Committee, FIXTURE, { files, spreadsheets })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Download spreadsheet' }))

    const tables = vi.mocked(spreadsheets.toXlsx).mock.calls[0][0]
    expect(tables.map((t) => t.name)).toEqual(['Monday', 'Thursday', 'Claims', 'History'])
    expect(files.save).toHaveBeenCalledWith('room-booking-2026-10-20.xlsx', expect.any(Blob), XLSX_MIME_TYPE)
    expect(screen.getByRole('status')).toHaveTextContent('Spreadsheet downloaded. Sign-up is still open, so claims may still change.')
  })

  it('doesn’t warn once sign-up has closed', async () => {
    renderAs(ViewerRole.Committee, CLOSED)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Download spreadsheet' }))

    expect(screen.getByRole('status')).toHaveTextContent('Spreadsheet downloaded.')
    expect(screen.getByRole('status')).not.toHaveTextContent('still open')
  })

  it('reports a failure and saves nothing', async () => {
    const files = fakeFiles()
    const spreadsheets = { toXlsx: vi.fn().mockResolvedValue({ ok: false, failure: DataFailure.Unknown }) }
    renderAs(ViewerRole.Committee, FIXTURE, { files, spreadsheets })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Download spreadsheet' }))

    expect(screen.getByRole('alert')).toHaveTextContent(DATA_FAILURE_MESSAGES[DataFailure.Unknown])
    expect(files.save).not.toHaveBeenCalled()
  })
})
