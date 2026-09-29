import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignedInUser } from '../domain/auth'
import { DataFailure } from '../domain/failure'
import { ProfileFailure } from '../domain/profile'
import type { RoomsResult } from '../domain/rooms'
import { FIXTURE, FIXTURE_NOW, ME, S, SE } from '../test/roomsFixture'
import { fakeAuth, fakeProfiles, fakeRooms, renderWithRepos } from '../test/fakes'
import { App } from './App'
import { DATA_FAILURE_MESSAGES, PROFILE_FAILURE_MESSAGES } from './messages'
import { SignedInApp } from './SignedInApp'

const PROFILE = { userId: ME, displayName: 'Me' }

// Renders the signed-in app at a URL with the fixture term.
function renderRooms(url: string, repos = {}) {
  return renderWithRepos(
    <SignedInApp profile={PROFILE} onProfileChange={() => {}} />,
    { rooms: fakeRooms(FIXTURE), ...repos },
    url,
  )
}

// The phone layout (rendered alongside the grid; CSS picks one by screen width).
async function phoneView() {
  return within(await screen.findByRole('region', { name: /^Thu|^Mon/ }))
}

// Theme, rename and sign-out live in the account menu.
async function openAccountMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Me, account menu' }))
}

function location() {
  return screen.getByTestId('location').textContent
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FIXTURE_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('routing', () => {
  it('opens / on the day with the next session', async () => {
    renderRooms('/')
    await screen.findByRole('region')
    expect(location()).toBe('/thursday')
  })

  it('sends an unknown day back to the default', async () => {
    renderRooms('/friday')
    await screen.findByRole('region')
    expect(location()).toBe('/thursday')
  })

  it('opens a day on its next session', async () => {
    renderRooms('/thursday')
    const phone = await phoneView()
    expect(phone.getByRole('heading', { name: 'Thursday 22 October' })).toBeInTheDocument()
    expect(phone.getByText('Week 2 of 3')).toBeInTheDocument()
  })

  it('opens a shared link on its week', async () => {
    renderRooms('/thursday?week=2026-10-15')
    const phone = await phoneView()
    expect(phone.getByRole('heading', { name: 'Thursday 15 October' })).toBeInTheDocument()
  })

  it('corrects a link to a non-session date in place', async () => {
    renderRooms('/thursday?week=2026-10-16')
    await phoneView()
    expect(location()).toBe('/thursday?week=2026-10-22')
  })
})

describe('phone week view', () => {
  it('describes every room in words, in PDF order', async () => {
    renderRooms('/thursday?week=2026-10-22')
    const items = (await phoneView()).getAllByRole('listitem')

    expect(items.map((li) => li.textContent)).toEqual([`${SE}You · SamManage`, `${S}Not every weekAlex (quiet room)`])
  })

  it('moves between weeks and updates the URL', async () => {
    renderRooms('/thursday?week=2026-10-22')
    const user = userEvent.setup()
    const phone = await phoneView()

    await user.click(phone.getByRole('button', { name: 'Next week' }))
    expect(location()).toBe('/thursday?week=2026-10-29')
    expect(screen.getAllByText('Sam · 1 space').length).toBeGreaterThan(0)
    expect(phone.getByRole('button', { name: 'Next week' })).toBeDisabled()
  })

  it('shows unbooked rooms and marks past sessions for screen readers', async () => {
    renderRooms('/monday?week=2026-10-19')
    const phone = await phoneView()

    expect(phone.getByText('(past session)', { exact: false })).toHaveClass('sr-only')
    expect(phone.getByRole('button', { name: 'Previous week' })).toBeEnabled()
  })
})

describe('desktop grid', () => {
  it('lays out weeks by rooms and highlights the shown week', async () => {
    renderRooms('/thursday?week=2026-10-22')
    const grid = within(await screen.findByRole('table', { name: 'Thursday rooms, by week' }))

    expect(grid.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Week', SE, `${S}Not every week`])
    const current = grid.getAllByRole('row').find((row) => row.getAttribute('aria-current') === 'date')
    expect(current).toHaveTextContent('Thu 22 Oct')
    expect(grid.getAllByRole('cell').map((td) => td.textContent)).toContain('Not booked')
  })

  it('selects a week from the grid', async () => {
    renderRooms('/thursday')
    const user = userEvent.setup()
    const grid = within(await screen.findByRole('table'))

    await user.click(grid.getByRole('button', { name: 'Thursday 29 October' }))
    expect(location()).toBe('/thursday?week=2026-10-29')
  })
})

describe('your sessions', () => {
  it('lists my claims with links to their week', async () => {
    renderRooms('/monday')
    const link = await screen.findByRole('link', { name: `Thu 22 Oct · ${SE}` })

    expect(screen.getByText('Your sessions (1)')).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/thursday?week=2026-10-22')
  })
})

describe('theme', () => {
  it('switches to dark and remembers it', async () => {
    renderRooms('/thursday')
    const user = userEvent.setup()

    await openAccountMenu(user)
    await user.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('forgets the choice when set back to match device', async () => {
    localStorage.setItem('theme', 'dark')
    renderRooms('/thursday')
    const user = userEvent.setup()

    await openAccountMenu(user)
    await user.click(screen.getByRole('radio', { name: 'Device' }))

    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBeNull()
  })
})

describe('account menu', () => {
  it('opens on click and closes with Escape', async () => {
    renderRooms('/thursday')
    const user = userEvent.setup()
    const button = await screen.findByRole('button', { name: 'Me, account menu' })

    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('reopens how it works', async () => {
    renderRooms('/thursday')
    const user = userEvent.setup()

    await openAccountMenu(user)
    await user.click(screen.getByRole('button', { name: 'How it works' }))

    expect(screen.getByRole('dialog', { name: 'How it works' })).toBeInTheDocument()
  })
})

describe('change name', () => {
  it('renames and reloads the rooms so the grid shows it', async () => {
    const rooms = fakeRooms(FIXTURE)
    const onProfileChange = vi.fn()
    renderWithRepos(<SignedInApp profile={PROFILE} onProfileChange={onProfileChange} />, { rooms }, '/thursday')
    const user = userEvent.setup()

    await openAccountMenu(user)
    await user.click(screen.getByRole('button', { name: 'Change name' }))
    const input = screen.getByLabelText('Display name')
    await user.clear(input)
    await user.type(input, 'Jordan')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(onProfileChange).toHaveBeenCalledWith({ userId: ME, displayName: 'Jordan' })
  })

  it('explains when the name is taken', async () => {
    const profiles = fakeProfiles({ renameProfile: vi.fn().mockResolvedValue({ ok: false, failure: ProfileFailure.NameTaken }) })
    renderRooms('/thursday', { profiles })
    const user = userEvent.setup()

    await openAccountMenu(user)
    await user.click(screen.getByRole('button', { name: 'Change name' }))
    await user.type(screen.getByLabelText('Display name'), '2')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(screen.getByRole('alert')).toHaveTextContent(PROFILE_FAILURE_MESSAGES[ProfileFailure.NameTaken])
  })
})

describe('loading', () => {
  it('shows placeholders, announced as loading, until the rooms arrive', async () => {
    let finish: (result: RoomsResult) => void = () => {}
    const loadRooms = vi.fn(() => new Promise<RoomsResult>((resolve) => (finish = resolve)))
    renderRooms('/thursday', { rooms: fakeRooms(FIXTURE, { loadRooms }) })

    expect(screen.getByRole('status')).toHaveTextContent('Loading rooms…')
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')

    finish({ ok: true, data: FIXTURE })
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Loading rooms…')).not.toBeInTheDocument()
  })

  it('offers a retry when rooms fail to load', async () => {
    const loadRooms = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, failure: DataFailure.Network })
      .mockResolvedValueOnce({ ok: true, data: FIXTURE })
    renderRooms('/thursday', { rooms: fakeRooms(FIXTURE, { loadRooms }) })
    const user = userEvent.setup()

    expect(await screen.findByRole('alert')).toHaveTextContent(DATA_FAILURE_MESSAGES[DataFailure.Network])
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})

describe('deep links while signed out', () => {
  it('lands on the shared week after signing in', async () => {
    let reportUser: (user: SignedInUser | null) => void = () => {}
    const auth = fakeAuth({
      onUserChange: vi.fn((callback) => {
        reportUser = callback
        callback(null)
        return () => {}
      }),
    })
    const profiles = fakeProfiles({ getProfile: vi.fn().mockResolvedValue({ ok: true, profile: PROFILE }) })
    renderWithRepos(<App />, { auth, profiles, rooms: fakeRooms(FIXTURE) }, '/thursday?week=2026-10-29')

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    act(() => reportUser({ id: ME, email: 'me@university.example' }))

    const phone = await phoneView()
    expect(phone.getByRole('heading', { name: 'Thursday 29 October' })).toBeInTheDocument()
    expect(location()).toBe('/thursday?week=2026-10-29')
  })
})
