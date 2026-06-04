import { render, screen, fireEvent } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap } from './useFocusTrap'

function Dialog({ onClose = () => {}, autofocus = false, opts }) {
  const ref = useRef(null)
  useFocusTrap(ref, onClose, opts)
  return (
    <div ref={ref} role="dialog" tabIndex={-1}>
      <button>first</button>
      <button {...(autofocus ? { 'data-autofocus': '' } : {})}>second</button>
      <button>third</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('focuses the first focusable element on mount by default', () => {
    render(<Dialog />)
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('honours [data-autofocus] for the initial focus', () => {
    render(<Dialog autofocus />)
    expect(screen.getByText('second')).toHaveFocus()
  })

  it('uses opts.initialFocus when provided (e.g. the container itself)', () => {
    render(<Dialog opts={{ initialFocus: (el) => el }} />)
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<Dialog onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the triggering element on unmount (#152)', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    expect(trigger).toHaveFocus()

    const { unmount } = render(<Dialog />)
    expect(screen.getByText('first')).toHaveFocus() // moved into the dialog

    unmount()
    expect(trigger).toHaveFocus() // ...and handed back on close
    trigger.remove()
  })

  it('pulls focus back into the dialog when Tab fires with focus outside (#154)', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    render(<Dialog />)
    outside.focus() // focus escaped the dialog
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByText('first')).toHaveFocus() // scoped trap pulls it back
    outside.remove()
  })
})
