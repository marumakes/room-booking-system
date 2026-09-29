import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthFailure, RESEND_COOLDOWN_SECONDS } from '../domain/auth'
import { fakeAuth, renderWithRepos } from '../test/fakes'
import { AUTH_FAILURE_MESSAGES, NOT_ALLOWED_EMAIL_MESSAGE } from './messages'
import { SignInPage } from './SignInPage'

// Fills in the email step and submits it.
async function submitEmail(email: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Your university email'), email)
  await user.click(screen.getByRole('button', { name: 'Send code' }))
  return user
}

describe('SignInPage', () => {
  it('rejects a outside-domain email without contacting the server', async () => {
    const auth = fakeAuth()
    renderWithRepos(<SignInPage />, { auth })

    await submitEmail('someone@gmail.com')

    expect(screen.getByRole('alert')).toHaveTextContent(NOT_ALLOWED_EMAIL_MESSAGE)
    expect(auth.requestCode).not.toHaveBeenCalled()
  })

  it('sends a code and moves to the code step with junk/quarantine help', async () => {
    const auth = fakeAuth()
    renderWithRepos(<SignInPage />, { auth })

    await submitEmail('a.student@university.example')

    expect(auth.requestCode).toHaveBeenCalledWith('a.student@university.example')
    expect(screen.getByText('a.student@university.example')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Outlook quarantine' })).toHaveAttribute(
      'href',
      'https://security.microsoft.com/quarantine',
    )
    expect(screen.getByRole('button', { name: `Resend code in ${RESEND_COOLDOWN_SECONDS}s` })).toBeDisabled()
  })

  it('shows the server’s rejection if the email is refused', async () => {
    const auth = fakeAuth({ requestCode: vi.fn().mockResolvedValue({ ok: false, failure: AuthFailure.RateLimited }) })
    renderWithRepos(<SignInPage />, { auth })

    await submitEmail('a.student@university.example')

    expect(screen.getByRole('alert')).toHaveTextContent(AUTH_FAILURE_MESSAGES[AuthFailure.RateLimited])
    expect(screen.getByLabelText('Your university email')).toBeInTheDocument()
  })

  it('verifies automatically once 6 digits are entered, ignoring spaces', async () => {
    const auth = fakeAuth()
    renderWithRepos(<SignInPage />, { auth })
    const user = await submitEmail('a.student@university.example')

    await user.type(screen.getByLabelText('6-digit code'), '123 456')

    expect(auth.verifyCode).toHaveBeenCalledWith('a.student@university.example', '123456')
  })

  it('explains a wrong code and clears the box', async () => {
    const auth = fakeAuth({ verifyCode: vi.fn().mockResolvedValue({ ok: false, failure: AuthFailure.CodeInvalid }) })
    renderWithRepos(<SignInPage />, { auth })
    const user = await submitEmail('a.student@university.example')

    await user.type(screen.getByLabelText('6-digit code'), '000000')

    expect(await screen.findByRole('alert')).toHaveTextContent(AUTH_FAILURE_MESSAGES[AuthFailure.CodeInvalid])
    expect(screen.getByLabelText('6-digit code')).toHaveValue('')
  })

  it('goes straight to the code step for someone who already has a code', async () => {
    const auth = fakeAuth()
    renderWithRepos(<SignInPage />, { auth })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Your university email'), 'a.student@university.example')
    await user.click(screen.getByRole('button', { name: 'I already have a code' }))

    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument()
    expect(auth.requestCode).not.toHaveBeenCalled()
  })

  it('lets the user go back and change their email', async () => {
    renderWithRepos(<SignInPage />)
    const user = await submitEmail('a.student@university.example')

    await user.click(screen.getByRole('button', { name: 'Use a different email' }))

    expect(screen.getByLabelText('Your university email')).toHaveValue('a.student@university.example')
  })
})
