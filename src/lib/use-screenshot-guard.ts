import { useEffect, useRef, useState } from 'react'

/**
 * Best-effort screenshot deterrent. Browsers cannot block OS screenshots, so this
 * catches the common shortcuts (PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5, print),
 * blurs the room whenever the tab loses focus, and calls `onAttempt` so the partner
 * can be notified.
 */
export function useScreenshotGuard(enabled: boolean, onAttempt: () => void) {
  const [hidden, setHidden] = useState(false)
  const cb = useRef(onAttempt)
  useEffect(() => {
    cb.current = onAttempt
  })

  useEffect(() => {
    if (!enabled) return
    let last = 0
    const fire = () => {
      // Shortcuts fire both keydown and keyup; report once
      if (Date.now() - last < 1500) return
      last = Date.now()
      setHidden(true)
      navigator.clipboard?.writeText('📵 Capture ممنوع في First Date').catch(() => {})
      cb.current()
      window.setTimeout(() => setHidden(!document.hasFocus()), 1800)
    }
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key ?? '').toLowerCase()
      if (k === 'printscreen' || e.code === 'PrintScreen') return fire()
      if (e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(k)) return fire()
      if ((e.ctrlKey || e.metaKey) && k === 'p') {
        e.preventDefault()
        return fire()
      }
      if ((e.ctrlKey || e.metaKey) && k === 's') e.preventDefault()
    }
    const onBlur = () => setHidden(true)
    const onFocus = () => setHidden(false)
    const onVisibility = () => setHidden(document.visibilityState !== 'visible')
    const block = (e: Event) => e.preventDefault()

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('beforeprint', fire)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('contextmenu', block)
    document.addEventListener('copy', block)
    document.addEventListener('dragstart', block)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('beforeprint', fire)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('copy', block)
      document.removeEventListener('dragstart', block)
    }
  }, [enabled])

  return hidden
}
