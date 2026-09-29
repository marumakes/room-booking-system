import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'

// A page control behind the sheet, plus a sheet with two controls of its own.
function renderSheet() {
  return render(
    <>
      <button type="button">Behind</button>
      <Sheet title="Test sheet" onClose={vi.fn()}>
        <input aria-label="Name" />
        <button type="button">Save</button>
      </Sheet>
    </>,
  )
}

describe('Sheet', () => {
  it('moves focus into the sheet when it opens', () => {
    renderSheet()

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('keeps Tab inside the sheet, wrapping from the last control to the first', async () => {
    renderSheet()
    const user = userEvent.setup()

    await user.tab()
    expect(screen.getByLabelText('Name')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control to the last', async () => {
    renderSheet()
    const user = userEvent.setup()

    await user.tab({ shift: true })

    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
  })
})
