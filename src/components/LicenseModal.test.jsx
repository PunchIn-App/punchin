import { useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import LicenseModal from './LicenseModal'

describe('LicenseModal', () => {
  it('renders as an accessible dialog titled "License & legal"', () => {
    render(<LicenseModal onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('License & legal')).toBeInTheDocument()
  })

  it('shows the app (BUSL) license text by default', () => {
    render(<LicenseModal onClose={() => {}} />)
    expect(screen.getByText(/Business Source License 1\.1/)).toBeInTheDocument()
  })

  it('switches to the third-party attributions section', () => {
    render(<LicenseModal onClose={() => {}} />)
    const thirdBtn = screen.getByRole('button', { name: /third-party/i })
    fireEvent.click(thirdBtn)
    expect(thirdBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Third-Party Licenses/)).toBeInTheDocument()
  })

  it('calls onClose from the close button', () => {
    const onClose = vi.fn()
    render(<LicenseModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close license/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<LicenseModal onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<LicenseModal onClose={onClose} />)
    fireEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on hardware/gesture Back (popstate)', () => {
    const onClose = vi.fn()
    render(<LicenseModal onClose={onClose} />)
    fireEvent.popState(window)
    expect(onClose).toHaveBeenCalled()
  })

  // See ChangelogModal.test.jsx for the full explanation: AboutPanel renders
  // this modal with an inline arrow for onClose, so a back-dismiss effect keyed
  // on that callback re-runs on every parent re-render — pushing a history entry
  // each time and letting the cleanup's deferred history.back() dismiss the
  // modal on its own (issue #276).
  it('re-rendering the parent neither leaks a history entry nor self-dismisses (#276)', () => {
    const onClose = vi.fn()
    const pushState = vi.spyOn(history, 'pushState')
    try {
      let rerender
      function Parent() {
        const [n, setN] = useState(0)
        rerender = () => act(() => setN((v) => v + 1))
        return <LicenseModal onClose={() => onClose(n)} />
      }
      render(<Parent />)
      expect(pushState).toHaveBeenCalledTimes(1)

      rerender()
      rerender()
      rerender()

      expect(pushState).toHaveBeenCalledTimes(1)
      expect(onClose).not.toHaveBeenCalled()
    } finally {
      pushState.mockRestore()
    }
  })
})
