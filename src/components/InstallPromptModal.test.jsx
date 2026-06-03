import { render, screen, fireEvent } from '@testing-library/react'
import InstallPromptModal from './InstallPromptModal'

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { hapticFeedback: true }, updateSetting: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('InstallPromptModal — native mode', () => {
  const props = () => ({ mode: 'native', onInstall: vi.fn(), onClose: vi.fn() })

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

describe('InstallPromptModal — ios-safari mode', () => {
  const props = () => ({ mode: 'ios-safari', onInstall: vi.fn(), onClose: vi.fn() })

  it('renders the Share → Add to Home Screen steps and a "Got it" button', () => {
    render(<InstallPromptModal {...props()} />)
    expect(screen.getByText(/from safari/i)).toBeInTheDocument()
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^install$/i })).not.toBeInTheDocument()
  })

  it('calls onClose when "Got it" is clicked', () => {
    const p = props()
    render(<InstallPromptModal {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(p.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('InstallPromptModal — ios-other mode (Chrome/Firefox on iOS)', () => {
  const props = () => ({ mode: 'ios-other', onInstall: vi.fn(), onClose: vi.fn() })

  it('tells the user to open in Safari rather than giving Safari-only steps as if they work', () => {
    render(<InstallPromptModal {...props()} />)
    expect(screen.getByText(/open this page in/i)).toBeInTheDocument()
    expect(screen.getByText(/only ios browser that can add web apps/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^install$/i })).not.toBeInTheDocument()
  })
})
