'use client'

/**
 * "Mark booked" on a planned / to-book item — the traveller confirms they've
 * actually reserved it, graduating the card to 'booked' so it loses the dashed
 * "planned" texture and joins the real timeline. Single-click (non-destructive).
 * Mostly for items reserved off-platform; a forwarded confirmation email flips
 * the same status automatically via the ingest auto-match.
 */

import { useTransition } from 'react'
import { Check } from 'lucide-react'
import { setBookingStatus } from '@/lib/actions'

export function MarkBookedButton({ id, tripSlug }: { id: string; tripSlug: string }) {
  const [pending, startTransition] = useTransition()

  function click(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const fd = new FormData()
    fd.set('id', id)
    fd.set('tripSlug', tripSlug)
    fd.set('status', 'booked')
    startTransition(async () => { await setBookingStatus(fd) })
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] transition text-ink-muted hover:bg-sage-soft hover:text-sage-dark"
      title="Mark as booked"
    >
      <Check className="w-3 h-3" />
      {pending ? '…' : 'Mark booked'}
    </button>
  )
}
