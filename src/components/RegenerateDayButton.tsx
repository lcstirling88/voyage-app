'use client'

/**
 * "Reimagine day" — in a day's header when that day holds AI suggestions. Asks
 * Itinera for a fresh set of ideas for the day in the same city, keeping any
 * real (booked) items fixed. The old suggestions are only replaced on success.
 */

import { useState, useTransition } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { regenerateDay } from '@/lib/actions'

export function RegenerateDayButton({ tripSlug, date }: { tripSlug: string; date: string }) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState(false)

  function click() {
    setErr(false)
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('date', date)
    startTransition(async () => {
      const res = await regenerateDay(fd)
      if (!res.ok) setErr(true)
    })
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-full border h-8 px-3 text-[11px] uppercase tracking-[0.16em] transition disabled:opacity-70 ${
        err
          ? 'border-rust/40 text-rust hover:bg-rust/10'
          : 'border-line bg-paper-pure text-ink-muted hover:border-sage hover:text-sage-dark'
      }`}
      title="Ask Itinera for a fresh set of ideas for this day"
    >
      {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{pending ? 'Reimagining…' : err ? 'Try again' : 'Reimagine day'}</span>
    </button>
  )
}
