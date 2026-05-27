'use client'
import { useEffect, useState } from 'react'
import { differenceInDays, startOfDay } from 'date-fns'

/**
 * Big countdown numeral for the trip Overview hero. Adapts to trip phase:
 *
 *   • before departure → "20  /  DAYS TO GO"
 *   • during the trip  → "3   /  DAY OF 16"
 *   • after the trip   → italic "Wrapped."
 *
 * Renders the numeral itself huge and the label tiny in uppercase tracking,
 * so the trip's most emotionally-charged number is the dominant visual on
 * the page. Ticks every minute so it updates without a manual reload.
 */
type Phase = 'before' | 'during' | 'after'

type Display =
  | { phase: 'before' | 'during'; number: number; label: string }
  | { phase: 'after'; label: string }

function compute(startISO: string, endISO: string): Display {
  const now = startOfDay(new Date())
  const start = startOfDay(new Date(startISO))
  const end = startOfDay(new Date(endISO))
  const totalDays = Math.max(1, differenceInDays(end, start) + 1)

  if (now < start) {
    const days = differenceInDays(start, now)
    return {
      phase: 'before',
      number: days,
      label: days === 1 ? 'Day to go' : 'Days to go',
    }
  }
  if (now <= end) {
    const dayN = Math.min(totalDays, differenceInDays(now, start) + 1)
    return {
      phase: 'during',
      number: dayN,
      label: `Day of ${totalDays}`,
    }
  }
  return { phase: 'after', label: 'Wrapped' }
}

export function TripCountdownDisplay({
  startISO,
  endISO,
}: {
  startISO: string
  endISO: string
}) {
  const [state, setState] = useState<Display>(() => compute(startISO, endISO))

  useEffect(() => {
    const tick = () => setState(compute(startISO, endISO))
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [startISO, endISO])

  if (state.phase === 'after') {
    return (
      <div className="text-paper-pure">
        <div className="font-display italic text-5xl sm:text-7xl leading-none text-paper-pure/90">
          {state.label}.
        </div>
      </div>
    )
  }

  return (
    <div className="text-paper-pure">
      <div className="font-display num-mono leading-[0.85] tracking-tight text-[110px] sm:text-[180px] lg:text-[220px]">
        {state.number}
      </div>
      <div className="mt-3 sm:mt-4 flex items-center gap-3">
        <span className="w-6 sm:w-8 h-px bg-sakura/60" aria-hidden />
        <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-paper-pure/75">
          {state.label}
        </span>
      </div>
    </div>
  )
}

// Re-export the phase type in case other components need to gate behaviour
// on whether the trip is over yet — kept in this module as the single
// source of truth for trip phase computation.
export type { Phase }
