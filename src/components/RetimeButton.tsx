'use client'

/**
 * Compact clock control on a kept itinerary item. Opens a small popover with a
 * native time picker plus Morning/Afternoon/Night shortcuts. Picking a time
 * both reorders the item within its session and (if the time lands in another
 * session's range) moves it there — the heavy lifting is in retimeBooking.
 * Suggestions (ideas) don't get this; they're kept or swapped first.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { retimeBooking } from '@/lib/actions'

const SESSION_SHORTCUTS: { label: string; value: string }[] = [
  { label: 'Morn', value: '09:00' },
  { label: 'Aft', value: '13:00' },
  { label: 'Night', value: '19:00' },
]

export function RetimeButton({
  id, tripSlug, currentTime,
}: {
  id: string
  tripSlug: string
  currentTime: string   // HH:mm, 24h
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function retime(time: string) {
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('id', id)
    fd.set('time', time)
    startTransition(async () => {
      const res = await retimeBooking(fd)
      if (res.ok) {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o) }}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-ink-muted transition hover:bg-paper hover:text-ink"
        title="Change time"
        aria-label="Change time"
      >
        <Clock className="w-3 h-3" />
        {pending && '…'}
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false) }}
          />
          <div
            className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-line bg-paper-pure p-2 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="time"
              defaultValue={currentTime}
              className="input num-mono w-full py-1.5 text-sm"
              onChange={(e) => { if (e.target.value) retime(e.target.value) }}
            />
            <div className="mt-2 flex gap-1">
              {SESSION_SHORTCUTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => retime(s.value)}
                  className="flex-1 rounded border border-line py-1 text-[10px] uppercase tracking-[0.1em] text-ink-muted transition hover:border-sage hover:bg-sage hover:text-paper-pure"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
