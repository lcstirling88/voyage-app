'use client'
import { useEffect, useState } from 'react'
import { differenceInDays } from 'date-fns'

export function CountdownClient({ to }: { to: string }) {
  const [days, setDays] = useState<number>(() => Math.max(0, differenceInDays(new Date(to), new Date())))

  useEffect(() => {
    const tick = () => setDays(Math.max(0, differenceInDays(new Date(to), new Date())))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [to])

  return <span className="num-mono">{days}</span>
}
