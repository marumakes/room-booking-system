import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SignedInUser } from '../domain/auth'
import { DisplayNameProblem } from '../domain/displayName'
import { ProfileFailure } from '../domain/profile'
import { TEST_USER, fakeAuth, fakeProfiles, renderWithRepos } from '../test/fakes'
import { App } from './App'
import { DISPLAY_NAME_MESSAGES, HELP_TEXT, PROFILE_FAILURE_MESSAGES } from './messages'

// Auth fake that reports the given user as signed in straight away.
function signedInAs(user: SignedInUser | null) {
  return fakeAuth({
    onUserChange: vi.fn((callback) => {
      callback(user)
      return () => {}
    }),
  })
}

describe('App', () => {
  it('shows sign-in when nobody is signed in', () => {
    renderWithRepos(<App />, { auth: signedInAs(null) })

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(HELP_TEXT)
  })

  it('asks a first-time user for a display name, then shows the rooms', async () => {
    const profiles = fakeProfiles()
    renderWithRepos(<App />, { auth: signedInAs(TEST_USER), profiles })
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Display name'), '  Alex  ')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(profiles.createProfile).toHaveBeenCalledWith(TEST_USER.id, 'Alex')
    expect(await screen.findByRole('button', { name: 'Alex, account menu' })).toBeInTheDocument()
  })

  it('welcomes a first-time user with how it works, once they have a name', async () => {
    renderWithRepos(<App />, { auth: signedInAs(TEST_USER), profiles: fakeProfiles() })
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Display name'), 'Alex')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const welcome = within(await screen.findByRole('dialog', { name: 'Welcome, Alex' }))

    expect(welcome.getByText(/aren’t enough rooms for every host to have their own/)).toBeInTheDocument()
    await user.click(welcome.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rejects a blank display name without saving', async () => {
    const profiles = fakeProfiles()
    renderWithRepos(<App />, { auth: signedInAs(TEST_USER), profiles })
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Display name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByRole('alert')).toHaveTextContent(DISPLAY_NAME_MESSAGES[DisplayNameProblem.Empty])
    expect(profiles.createProfile).not.toHaveBeenCalled()
  })

  it('skips the name prompt for a returning user', async () => {
    const profiles = fakeProfiles({
      getProfile: vi.fn().mockResolvedValue({ ok: true, profile: { userId: TEST_USER.id, displayName: 'Sam' } }),
    })
    renderWithRepos(<App />, { auth: signedInAs(TEST_USER), profiles })

    expect(await screen.findByRole('button', { name: 'Sam, account menu' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(HELP_TEXT)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers a retry when the profile fails to load', async () => {
    const getProfile = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, failure: ProfileFailure.Network })
      .mockResolvedValueOnce({ ok: true, profile: { userId: TEST_USER.id, displayName: 'Sam' } })
    renderWithRepos(<App />, { auth: signedInAs(TEST_USER), profiles: fakeProfiles({ getProfile }) })
    const user = userEvent.setup()

    expect(await screen.findByRole('alert')).toHaveTextContent(PROFILE_FAILURE_MESSAGES[ProfileFailure.Network])
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('button', { name: 'Sam, account menu' })).toBeInTheDocument()
  })
})

describe('privacy note', () => {
  it('can be read from the sign-in screen, before giving an email', async () => {
    renderWithRepos(<App />, { auth: signedInAs(null) })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Privacy: what we store' }))
    const note = within(screen.getByRole('dialog', { name: 'What we store and why' }))

    expect(note.getByText(/only to send your sign-in code/)).toBeInTheDocument()
    expect(note.getByText(/deleted from this app/)).toBeInTheDocument()
    await user.click(note.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
