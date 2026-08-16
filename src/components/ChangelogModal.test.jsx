import { useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ChangelogModal from './ChangelogModal'

vi.mock('../../docs/CHANGELOG.md?raw', () => ({
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

  it('closes on hardware/gesture Back (popstate)', () => {
    const onClose = vi.fn()
    render(<ChangelogModal onClose={onClose} />)
    fireEvent.popState(window)
    expect(onClose).toHaveBeenCalled()
  })

  // Issue #276's failure shape. AboutPanel renders this modal with an inline
  // `onClose={() => setShowChangelog(false)}`, so every parent re-render — and
  // the parent re-renders on each useSettings liveQuery tick, each usePwaUpdate
  // timeout, and on a tablet rotation crossing SettingsView's 1024px
  // matchMedia — hands the modal a NEW callback identity. A back-dismiss effect
  // keyed on that identity tears down and re-runs on every one of them, leaking
  // a history entry per render and letting the cleanup's deferred
  // `history.back()` land on the freshly-attached listener.
  it('re-rendering the parent neither leaks a history entry nor self-dismisses (#276)', () => {
    const onClose = vi.fn()
    const pushState = vi.spyOn(history, 'pushState')
    try {
      let rerender
      function Parent() {
        const [n, setN] = useState(0)
        rerender = () => act(() => setN((v) => v + 1))
        return <ChangelogModal onClose={() => onClose(n)} />
      }
      render(<Parent />)
      expect(pushState).toHaveBeenCalledTimes(1)

      rerender()
      rerender()
      rerender()

      // One entry pushed for the one open modal, not one per render.
      expect(pushState).toHaveBeenCalledTimes(1)
      // And the modal has not closed itself behind the user's back.
      expect(onClose).not.toHaveBeenCalled()
    } finally {
      pushState.mockRestore()
    }
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
