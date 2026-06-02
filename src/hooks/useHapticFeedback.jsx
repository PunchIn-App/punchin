import { useRef, useEffect, useCallback } from 'react'

// iOS Safari completely ignores navigator.vibrate(). The only way to trigger
// the Taptic Engine from a web context is the WebKit-proprietary `switch` input
// type. Toggling it programmatically fires a haptic tick. We must click the
// *label* rather than the input directly because WebKit blocks synthetic clicks
// on form controls for security reasons.
//
// The `switch` attribute is non-standard and unknown to React's prop validator,
// so it must be applied imperatively via setAttribute rather than as JSX props.

export function useHapticFeedback(os) {
  const inputRef = useRef(null)
  const labelRef = useRef(null)

  useEffect(() => {
    if (os === 'ios' && inputRef.current) {
      inputRef.current.setAttribute('switch', '')
    }
  }, [os])

  const trigger = useCallback(() => {
    if (os === 'android') {
      navigator.vibrate?.(40)
    } else if (os === 'ios') {
      labelRef.current?.click()
    }
    // 'web': no-op
  }, [os])

  // Rendered by the consumer only on iOS; null on all other platforms so there
  // is zero DOM cost outside of standalone iOS contexts.
  const hapticEl = os === 'ios' ? (
    <>
      <input
        ref={inputRef}
        type="checkbox"
        id="haptic-switch"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        readOnly
      />
      <label
        ref={labelRef}
        htmlFor="haptic-switch"
        className="sr-only"
        aria-hidden="true"
      />
    </>
  ) : null

  return { trigger, hapticEl }
}
