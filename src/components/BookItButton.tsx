'use client'

/**
 * The booking bridge's money moment: a planned item's "Book it" CTA. Opens the
 * provider deep-link (Booking.com / GetYourGuide / Maps — see lib/affiliates)
 * in a new tab and, in the same gesture, advances the item to 'to_book' so the
 * timeline remembers the traveller has gone out to reserve it.
 *
 * The open() runs synchronously inside the click handler — not in the
 * transition — so the browser keeps treating it as a user gesture and doesn't
 * block the popup. The card behind this is itself a <Link>, hence the
 * stopPropagation/preventDefault.
 */

import { useTransition } from 'react'
import { ExternalLink } from 'lucide-react'
import { setBookingStatus } from '@/lib/actions'

export function BookItButton({
  id, tripSlug, url, label,
}: {
  id: string
  tripSlug: string
  url: string
  label: string
}) {
  const [pending, startTransition] = useTransition()

  function click(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    // Open first, synchronously, so it counts as a user gesture (no popup block).
    window.open(url, '_blank', 'noopener,noreferrer')
    const fd = new FormData()
    fd.set('id', id)
    fd.set('tripSlug', tripSlug)
    fd.set('status', 'to_book')
    startTransition(async () => { await setBookingStatus(fd) })
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition bg-sage text-paper-pure hover:bg-sage-dark disabled:opacity-60"
      title="Book it — opens the provider in a new tab"
    >
      <ExternalLink className="w-3 h-3" />
      {pending ? '…' : label}
    </button>
  )
}
