import { render, screen, fireEvent } from '@testing-library/react'
import InfoButton from './InfoButton'

describe('InfoButton', () => {
  it('renders a labeled icon button, collapsed by default (no panel)', () => {
    render(<InfoButton label="About time format">Help text here</InfoButton>)
    const btn = screen.getByRole('button', { name: 'About time format' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Help text here')).not.toBeInTheDocument()
  })

  it('opens the help panel on click and flips aria-expanded', () => {
    render(<InfoButton label="About time format">Help text here</InfoButton>)
    fireEvent.click(screen.getByRole('button', { name: 'About time format' }))
    expect(screen.getByRole('button', { name: 'About time format' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('note')).toHaveTextContent('Help text here')
  })

  it('closes on Escape and restores focus to the button (WCAG 2.4.3)', () => {
    render(<InfoButton label="About time format">Help text here</InfoButton>)
    const btn = screen.getByRole('button', { name: 'About time format' })
    fireEvent.click(btn)
    expect(screen.getByText('Help text here')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Help text here')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(btn)
  })

  it('closes on an outside click', () => {
    render(
      <div>
        <InfoButton label="About X">Body copy</InfoButton>
        <button>outside</button>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'About X' }))
    expect(screen.getByText('Body copy')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByText('Body copy')).not.toBeInTheDocument()
  })

  it('does not bubble Escape to a surrounding modal handler', () => {
    const onModalEscape = vi.fn()
    render(
      <div onKeyDown={(e) => { if (e.key === 'Escape') onModalEscape() }}>
        <InfoButton label="About X">Body copy</InfoButton>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'About X' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Body copy')).not.toBeInTheDocument()
    expect(onModalEscape).not.toHaveBeenCalled()
  })
})
