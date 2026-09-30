import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 768

/** True below Tailwind's `md` breakpoint, where the sidebar becomes a sheet. */
export function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMobile(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return mobile
}
