import { render, screen, fireEvent } from '@testing-library/react'
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
})
