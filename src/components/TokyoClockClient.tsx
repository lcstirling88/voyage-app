'use client'
import { useEffect, useState } from 'react'
import { Clock, DollarSign } from 'lucide-react'

export function TokyoClockClient() {
  const [time, setTime] = useState<string>('—')

  useEffect(() => {
    const tick = () => {
      const fmt = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo', hour12: false,
      })
      setTime(fmt.format(new Date()))
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="hidden md:flex items-center gap-5 text-xs">
      <div className="flex items-center gap-2 text-ink-muted">
        <Clock className="w-3.5 h-3.5" />
        <span className="num-mono">Tokyo · {time}</span>
      </div>
      <div className="flex items-center gap-2 text-ink-muted">
        <DollarSign className="w-3.5 h-3.5" />
        <span className="num-mono">1 AUD = ¥98</span>
      </div>
    </div>
  )
}
