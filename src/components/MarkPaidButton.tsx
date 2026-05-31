'use client'

import { useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { setBookingPaid, setPaymentPaid } from '@/lib/actions'

/**
 * One-tap "Mark paid" toggle for a booking or a scheduled payment. Posts to the
 * matching server action (which stamps/clears paidAt and revalidates), so the
 * calendar, totals and ledger all update together. When already paid it renders
 * a quiet "Undo" so a mis-tap is reversible.
 */
export function MarkPaidButton({
  kind,
  id,
  tripSlug,
  paid,
}: {
  kind: 'booking' | 'payment'
  id: string
  tripSlug: string
  paid: boolean
}) {
  const [pending, startTransition] = useTransition()
  const action = kind === 'payment' ? setPaymentPaid : setBookingPaid

  function toggle() {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('tripSlug', tripSlug)
    fd.set('paid', String(!paid))
    startTransition(async () => {
      await action(fd)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={paid ? 'Mark as unpaid' : 'Mark as paid'}
      className={
        paid
          ? 'inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition disabled:opacity-50'
          : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-ink text-paper-pure hover:opacity-90 transition disabled:opacity-50'
      }
    >
      {pending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : paid ? null : (
        <Check className="w-3 h-3" />
      )}
      {paid ? 'Undo' : 'Mark paid'}
    </button>
  )
}
