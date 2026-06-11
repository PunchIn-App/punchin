import { render, screen, fireEvent } from '@testing-library/react'
import { useSwipeDismiss } from './useBottomSheet'

// Tiny harness: a sheet whose ref comes from useSwipeDismiss, containing a plain
// body region and a scrollable list (overflow-y-auto). We drive the gesture with
// fireEvent.touchStart/Move/End and assert whether onClose fired.
function Sheet({ onClose, haptic = () => {} }) {
  const ref = useSwipeDismiss(onClose, haptic)
  return (
    <div ref={ref} role="dialog">
      <div data-testid="body">sheet chrome</div>
      <div data-testid="list" className="overflow-y-auto">
        <button>job a</button>
        <button>job b</button>
      </div>
    </div>
  )
}

// jsdom does no layout, so scrollHeight/clientHeight are 0 and nothing reads as
// scrollable. Make the list look like a real overflow container: taller content
// than its box, a controllable scrollTop, and an overflow-y CSS value.
function makeScrollable(el, { scrollTop = 0 } = {}) {
  Object.defineProperty(el, 'scrollHeight', { value: 400, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
  let _top = scrollTop
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => _top,
    set: v => { _top = v },
  })
  // getComputedStyle reads inline/computed style in jsdom — set overflow there.
  el.style.overflowY = 'auto'
}

const touch = y => ({ touches: [{ clientY: y }], changedTouches: [{ clientY: y }] })

describe('useSwipeDismiss', () => {
  it('dismisses on a swipe-down past the threshold on the sheet body', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const body = screen.getByTestId('body')

    fireEvent.touchStart(body, touch(100))
    fireEvent.touchMove(body, touch(160))
    fireEvent.touchEnd(body, touch(200)) // +100px, no scroll container under finger

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fires the haptic exactly once on a real dismiss', () => {
    const onClose = vi.fn()
    const haptic = vi.fn()
    render(<Sheet onClose={onClose} haptic={haptic} />)
    const body = screen.getByTestId('body')

    fireEvent.touchStart(body, touch(100))
    fireEvent.touchEnd(body, touch(200))

    expect(haptic).toHaveBeenCalledTimes(1)
  })

  it('does NOT dismiss when a downward drag scrolls an inner overflow list', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const list = screen.getByTestId('list')
    makeScrollable(list, { scrollTop: 0 })

    fireEvent.touchStart(list, touch(100))
    // The list actually scrolls during the gesture (content moves under finger).
    list.scrollTop = 30
    fireEvent.touchMove(list, touch(160))
    fireEvent.touchEnd(list, touch(200)) // net +100px, but it was a scroll

    expect(onClose).not.toHaveBeenCalled()
  })

  it('does NOT dismiss when the gesture starts on a list already scrolled down', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const list = screen.getByTestId('list')
    makeScrollable(list, { scrollTop: 50 }) // not pinned to the top

    fireEvent.touchStart(list, touch(100))
    fireEvent.touchMove(list, touch(160))
    fireEvent.touchEnd(list, touch(200))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('still dismisses when dragging a list that is pinned at the top and not scrolled', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const list = screen.getByTestId('list')
    makeScrollable(list, { scrollTop: 0 }) // at the top, never moves

    fireEvent.touchStart(list, touch(100))
    fireEvent.touchMove(list, touch(160))
    fireEvent.touchEnd(list, touch(200))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('still dismisses when iOS rubber-band overscroll drives scrollTop negative at the top', () => {
    // On iOS a downward drag on a scroller already pinned at the top rubber-bands
    // and WebKit reports a transient NEGATIVE scrollTop. That must NOT cancel the
    // dismiss — only a real downward content scroll (scrollTop increases) does.
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const list = screen.getByTestId('list')
    makeScrollable(list, { scrollTop: 0 })

    fireEvent.touchStart(list, touch(100))
    list.scrollTop = -12 // overscroll bounce while pinned at the top
    fireEvent.touchMove(list, touch(160))
    fireEvent.touchEnd(list, touch(200))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores a small downward swipe under the threshold', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const body = screen.getByTestId('body')

    fireEvent.touchStart(body, touch(100))
    fireEvent.touchEnd(body, touch(150)) // +50px < 80px

    expect(onClose).not.toHaveBeenCalled()
  })
})
