import { render, screen, fireEvent } from '@testing-library/react'
import InstallPromptModal from './InstallPromptModal'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('InstallPromptModal — native (canInstall) variant', () => {
  const props = () => ({ canInstall: true, onInstall: vi.fn(), onClose: vi.fn() })

  it('renders the install CTA and a dismiss option', () => {
    render(<InstallPromptModal {...props()} />)
    expect(screen.getByRole('heading', { name: /install punchin/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^install$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument()
  })

  it('has accessible dialog semantics', () => {
    render(<InstallPromptModal {...props()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(dialog).toHaveAttribute('aria-describedby')
  })

  it('calls onInstall when Install is clicked', () => {
    const p = props()
    render(<InstallPromptModal {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /^install$/i }))
    expect(p.onInstall).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on "Not now", Escape, and backdrop click', () => {
    const p = props()
    const { container } = render(<InstallPromptModal {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /not now/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(container.firstChild)
    expect(p.onClose).toHaveBeenCalledTimes(3)
  })

  it('does not close when clicking inside the dialog', () => {
    const p = props()
    render(<InstallPromptModal {...p} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(p.onClose).not.toHaveBeenCalled()
  })
})

describe('InstallPromptModal — instructions (no native prompt) variant', () => {
  const props = () => ({ canInstall: false, onInstall: vi.fn(), onClose: vi.fn() })

  it('renders the Share → Add to Home Screen steps and a "Got it" button', () => {
    render(<InstallPromptModal {...props()} />)
    expect(screen.getByText(/share/i)).toBeInTheDocument()
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument()
    // No native install button in this variant.
    expect(screen.queryByRole('button', { name: /^install$/i })).not.toBeInTheDocument()
  })

  it('calls onClose when "Got it" is clicked', () => {
    const p = props()
    render(<InstallPromptModal {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(p.onClose).toHaveBeenCalledTimes(1)
  })
})
