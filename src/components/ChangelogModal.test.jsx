import { render, screen, fireEvent } from '@testing-library/react'
import ChangelogModal from './ChangelogModal'

vi.mock('../../CHANGELOG.md?raw', () => ({
  default: '## [1.0.0] — 2025-01-01\n### Added\n- **Bold feature**: something new\n- Plain bullet\n',
}))

describe('ChangelogModal — rendering', () => {
  it('renders "Changelog" header', () => {
    render(<ChangelogModal onClose={vi.fn()} />)
    expect(screen.getByText('Changelog')).toBeInTheDocument()
  })

  it('renders "v1.0.0"', () => {
    render(<ChangelogModal onClose={vi.fn()} />)
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
  })

  it('renders "2025-01-01"', () => {
    render(<ChangelogModal onClose={vi.fn()} />)
    expect(screen.getByText('2025-01-01')).toBeInTheDocument()
  })

  it('renders "Plain bullet"', () => {
    render(<ChangelogModal onClose={vi.fn()} />)
    expect(screen.getByText(/Plain bullet/)).toBeInTheDocument()
  })

  it('renders <strong> for **Bold feature**', () => {
    render(<ChangelogModal onClose={vi.fn()} />)
    const el = screen.getByText('Bold feature')
    expect(el.tagName.toLowerCase()).toBe('strong')
  })

  it('renders "Added" heading', () => {
    render(<ChangelogModal onClose={vi.fn()} />)
    expect(screen.getByText('Added')).toBeInTheDocument()
  })
})

describe('ChangelogModal — interactions', () => {
  it('close button calls onClose once', () => {
    const onClose = vi.fn()
    render(<ChangelogModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close changelog/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Escape calls onClose', () => {
    const onClose = vi.fn()
    render(<ChangelogModal onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('backdrop click calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<ChangelogModal onClose={onClose} />)
    fireEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking inside the dialog does NOT call onClose', () => {
    const onClose = vi.fn()
    render(<ChangelogModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ChangelogModal — focus trap', () => {
  it('Tab from last button wraps to first button', () => {
    render(<ChangelogModal onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    const buttons = Array.from(dialog.querySelectorAll('button:not([disabled])'))
    const last = buttons[buttons.length - 1]
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(buttons[0])
  })

  it('Shift+Tab from first button wraps to last button', () => {
    render(<ChangelogModal onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    const buttons = Array.from(dialog.querySelectorAll('button:not([disabled])'))
    buttons[0].focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(buttons[buttons.length - 1])
  })
})
