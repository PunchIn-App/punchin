import { render, screen, fireEvent, act } from '@testing-library/react'
import { useRef, useState } from 'react'
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

  // Stacked dialogs (e.g. a ConfirmModal opened from inside EditEntryModal):
  // both traps share the document keydown listener, so only the topmost
  // (most-recently-mounted) one may react to Escape/Tab.
  describe('stacked traps', () => {
    // A standalone trapped dialog — the inner one mounts in a later commit (via
    // the toggle below) so its keydown listener registers AFTER the outer one's,
    // mirroring the real mount order of a ConfirmModal opened from a parent modal.
    function TrappedDialog({ onClose, label, children }) {
      const ref = useRef(null)
      useFocusTrap(ref, onClose)
      return (
        <div ref={ref} role="dialog" aria-label={label} tabIndex={-1}>
          {children}
        </div>
      )
    }

    // Mounts the outer dialog first, then exposes openInner()/closeInner() so the
    // inner dialog mounts/unmounts in its own commit — outer stays mounted
    // throughout, just like a parent modal hosting a confirm.
    function Stack({ onOuterClose, onInnerClose }) {
      const [innerOpen, setInnerOpen] = useState(false)
      Stack.openInner = () => setInnerOpen(true)
      Stack.closeInner = () => setInnerOpen(false)
      return (
        <>
          <TrappedDialog onClose={onOuterClose} label="outer">
            <button>outer-first</button>
            <button>outer-second</button>
          </TrappedDialog>
          {innerOpen && (
            <TrappedDialog onClose={onInnerClose} label="inner">
              <button>inner-first</button>
              <button>inner-second</button>
            </TrappedDialog>
          )}
        </>
      )
    }

    it('routes Escape only to the topmost (inner) trap, never the outer', () => {
      const onOuterClose = vi.fn()
      const onInnerClose = vi.fn()
      render(<Stack onOuterClose={onOuterClose} onInnerClose={onInnerClose} />)
      act(() => Stack.openInner()) // inner trap mounts on top of the outer
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onInnerClose).toHaveBeenCalledTimes(1)
      expect(onOuterClose).not.toHaveBeenCalled()
    })

    it('keeps Tab within the inner dialog, not yanking focus to the outer', () => {
      render(<Stack onOuterClose={() => {}} onInnerClose={() => {}} />)
      act(() => Stack.openInner())
      // Focus the last focusable in the inner dialog, then Tab forward: the
      // topmost trap wraps to the inner dialog's first button — it must not
      // leak to the outer dialog's controls.
      screen.getByText('inner-second').focus()
      fireEvent.keyDown(document, { key: 'Tab' })
      expect(screen.getByText('inner-first')).toHaveFocus()
    })

    it('lets the outer trap respond to Escape once the inner trap unmounts', () => {
      const onOuterClose = vi.fn()
      const onInnerClose = vi.fn()
      render(<Stack onOuterClose={onOuterClose} onInnerClose={onInnerClose} />)
      act(() => Stack.openInner())
      act(() => Stack.closeInner()) // inner trap unmounts and pops off the stack
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onOuterClose).toHaveBeenCalledTimes(1)
    })
  })
})
