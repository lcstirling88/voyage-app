'use client'
import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

/**
 * One small clock for a given IANA timezone. The TopBar renders this twice
 * side-by-side — home city on the left, destination on the right — so the
 * user always sees both "where I am now" and "where this trip is" at a
 * glance. The clock icon only appears on the leftmost clock to avoid
 * visual repetition.
 */
export function LocalClockClient({
  timezone,
  cityLabel,
  showIcon = true,
}: {
  timezone: string
  cityLabel: string
  /** Show the clock icon to the left of the label. Defaults to true; pass
   *  false when this is the second clock in a row. */
  showIcon?: boolean
}) {
  const [time, setTime] = useState<string>('—')

  useEffect(() => {
    const tick = () => {
      try {
        const fmt = new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit', minute: '2-digit', timeZone: timezone, hour12: false,
        })
        setTime(fmt.format(new Date()))
      } catch {
        setTime('—')
      }
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [timezone])

  return (
    <div className="hidden md:flex items-center gap-2 text-xs text-ink-muted">
      {showIcon && <Clock className="w-3.5 h-3.5" />}
      <span className="num-mono">{cityLabel} · {time}</span>
    </div>
  )
}
