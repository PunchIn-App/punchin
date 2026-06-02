import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmModal from './ConfirmModal'

const defaultProps = {
  title: 'Delete this item?',
  message: 'This action cannot be undone.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConfirmModal — rendering', () => {
  it('renders title and message', () => {
    render(<ConfirmModal {...defaultProps} />)
    expect(screen.getByText('Delete this item?')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('renders without message when omitted', () => {
    render(<ConfirmModal title="Confirm?" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Confirm?')).toBeInTheDocument()
  })

  it('renders default "Delete" confirm button', () => {
    render(<ConfirmModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('renders custom confirmLabel', () => {
    render(<ConfirmModal {...defaultProps} confirmLabel="Archive" />)
    expect(screen.getByRole('button', { name: /^archive$/i })).toBeInTheDocument()
  })

  it('renders a Cancel button', () => {
    render(<ConfirmModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('has role="dialog" with aria-modal and aria-labelledby', () => {
    render(<ConfirmModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
  })
})

describe('ConfirmModal — interactions', () => {
  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel button is clicked', () => {
    render(<ConfirmModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Escape key is pressed', () => {
    render(<ConfirmModal {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not call onCancel for other keys', () => {
    render(<ConfirmModal {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(defaultProps.onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when clicking the backdrop (not the dialog)', () => {
    const { container } = render(<ConfirmModal {...defaultProps} />)
    const backdrop = container.firstChild
    fireEvent.click(backdrop)
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not call onCancel when clicking inside the dialog', () => {
    render(<ConfirmModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(defaultProps.onCancel).not.toHaveBeenCalled()
  })
})

describe('ConfirmModal — focus management', () => {
  it('focuses the Cancel button by default (safe default for destructive actions)', () => {
    render(<ConfirmModal {...defaultProps} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /cancel/i }))
  })
})

describe('ConfirmModal — focus trap (Tab wrapping)', () => {
  it('Tab from last button wraps focus to first button', () => {
    render(<ConfirmModal title="Test?" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    const first = buttons[0]
    const last  = buttons[buttons.length - 1]
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(first)
  })

  it('Shift+Tab from first button wraps focus to last button', () => {
    render(<ConfirmModal title="Test?" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    const first = buttons[0]
    const last  = buttons[buttons.length - 1]
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
