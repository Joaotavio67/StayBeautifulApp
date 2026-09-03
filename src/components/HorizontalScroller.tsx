import { useEffect, useRef } from 'react'

const AUTO_SCROLL_SPEED = 0.3 // px per animation frame (~18px/s at 60fps)
const RESUME_DELAY_MS = 3000

interface HorizontalScrollerProps {
  children: React.ReactNode
  className?: string
}

/**
 * Horizontally-scrolling row that slowly auto-scrolls back and forth,
 * pausing whenever the user hovers, touches, or drags it so reading
 * isn't interrupted. Also exposes discreet prev/next arrow buttons.
 */
export default function HorizontalScroller({ children, className }: HorizontalScrollerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const directionRef = useRef(1)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let rafId: number

    function tick() {
      if (el && !pausedRef.current) {
        const max = el.scrollWidth - el.clientWidth
        if (max > 1) {
          el.scrollLeft += AUTO_SCROLL_SPEED * directionRef.current
          if (el.scrollLeft >= max) directionRef.current = -1
          if (el.scrollLeft <= 0) directionRef.current = 1
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  function pause() {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    pausedRef.current = true
  }

  function resumeAfterDelay() {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => { pausedRef.current = false }, RESUME_DELAY_MS)
  }

  function scrollByCard(dir: 1 | -1) {
    pause()
    ref.current?.scrollBy({ left: dir * 270, behavior: 'smooth' })
    resumeAfterDelay()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="h-scroll-arrow h-scroll-arrow--left"
        onClick={() => scrollByCard(-1)}
        aria-label="Ver anterior"
      >
        ‹
      </button>
      <div
        ref={ref}
        className={`h-scroll${className ? ` ${className}` : ''}`}
        onMouseEnter={pause}
        onMouseLeave={resumeAfterDelay}
        onTouchStart={pause}
        onTouchEnd={resumeAfterDelay}
      >
        {children}
      </div>
      <button
        type="button"
        className="h-scroll-arrow h-scroll-arrow--right"
        onClick={() => scrollByCard(1)}
        aria-label="Ver próximo"
      >
        ›
      </button>
    </div>
  )
}
