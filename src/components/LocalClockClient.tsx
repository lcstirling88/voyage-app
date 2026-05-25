'use client'
import { useEffect, useState } from 'react'
import { Clock, DollarSign } from 'lucide-react'

export function LocalClockClient({
  timezone,
  cityLabel,
  fxLabel,
}: {
  timezone: string
  cityLabel: string
  fxLabel: string | null
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
    <div className="hidden md:flex items-center gap-5 text-xs">
      <div className="flex items-center gap-2 text-ink-muted">
        <Clock className="w-3.5 h-3.5" />
        <span className="num-mono">{cityLabel} · {time}</span>
      </div>
      {fxLabel && (
        <div className="flex items-center gap-2 text-ink-muted">
          <DollarSign className="w-3.5 h-3.5" />
          <span className="num-mono">{fxLabel}</span>
        </div>
      )}
    </div>
  )
}
