'use client'

import { useState, useTransition } from 'react'
import { Pencil, X, RotateCcw } from 'lucide-react'
import { setCancellationTerms } from '@/lib/actions'

/**
 * One booking's cancellation terms — a collapsed summary line that expands into
 * an edit form. The parser seeds the deadline / policy / refund from the
 * confirmation email; this lets the traveller correct or add to it (the user
 * asked specifically to be able to "amend or add their own"). Posts to the
 * setCancellationTerms server action, which revalidates the calendar so the
 * grid above updates the moment terms change.
 */
export function CancellationTermsEditor({
  bookingId,
  tripSlug,
  title,
  bookingType,
  contextLabel,
  homeCurrency,
  state,
  deadlineLabel,
  refundLabel,
  // form defaults
  cancelDateValue,
  cancelTimeValue,
  policyValue,
  refundAmountValue,
  refundCurrencyValue,
  nonRefundableValue,
}: {
  bookingId: string
  tripSlug: string
  title: string
  bookingType: string
  /** When the booking itself happens, for orientation, e.g. "Check-in 12 Jun". */
  contextLabel: string
  homeCurrency: string
  state: 'open' | 'soon' | 'closed' | 'none'
  deadlineLabel: string | null
  refundLabel: string
  cancelDateValue: string
  cancelTimeValue: string
  policyValue: string
  refundAmountValue: string
  refundCurrencyValue: string
  nonRefundableValue: boolean
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonRefundable, setNonRefundable] = useState(nonRefundableValue)
  const [pending, startTransition] = useTransition()

  const DOT: Record<typeof state, string> = {
    open: 'bg-sage',
    soon: 'bg-gold',
    closed: 'bg-ink-muted/40',
    none: 'bg-ink-muted/25',
  }
  const STATE_LABEL: Record<typeof state, string> = {
    open: 'Free-cancel window open',
    soon: 'Deadline approaching',
    closed: 'Free-cancel window closed',
    none: 'No terms set',
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('id', bookingId)
    fd.set('tripSlug', tripSlug)
    startTransition(async () => {
      const res = await setCancellationTerms(fd)
      if (res.ok) setOpen(false)
      else setError(res.error)
    })
  }

  return (
    <div className="border border-line rounded-lg bg-paper-pure">
      {/* Summary row */}
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT[state]}`} title={STATE_LABEL[state]} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{title}</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted shrink-0">{bookingType}</span>
          </div>
          <div className="text-[11px] text-ink-muted truncate">
            {deadlineLabel ? `Cancel by ${deadlineLabel}` : 'No deadline set'} · {contextLabel}
          </div>
        </div>
        <span className={`text-xs shrink-0 hidden sm:inline ${
          state === 'open' ? 'text-sage' : state === 'soon' ? 'text-gold' : 'text-ink-muted'
        }`}>
          {refundLabel}
        </span>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setError(null) }}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition"
          aria-expanded={open}
        >
          {open ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          {open ? 'Close' : 'Edit'}
        </button>
      </div>

      {/* Edit form */}
      {open && (
        <form onSubmit={submit} className="border-t border-line p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Free-cancel by — date</label>
              <input name="cancelDate" type="date" defaultValue={cancelDateValue} className="input mt-1 num-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Time</label>
              <input name="cancelTime" type="time" defaultValue={cancelTimeValue || '23:59'} className="input mt-1 num-mono" />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Policy summary</label>
            <input
              name="cancellationPolicy"
              defaultValue={policyValue}
              placeholder="e.g. Free cancellation up to 48 hours before check-in"
              className="input mt-1"
            />
          </div>

          <label className="flex gap-2 items-center text-xs">
            <input
              type="checkbox"
              name="nonRefundable"
              checked={nonRefundable}
              onChange={(e) => setNonRefundable(e.target.checked)}
              className="accent-rust"
            />
            Non-refundable — no money back if cancelled
          </label>

          <div className={`grid grid-cols-3 gap-3 transition ${nonRefundable ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Refund if cancelled in time</label>
              <input
                name="refundAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={refundAmountValue}
                disabled={nonRefundable}
                placeholder="Leave blank for full refund"
                className="input mt-1 num-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Currency</label>
              <input
                name="refundCurrency"
                defaultValue={refundCurrencyValue || homeCurrency}
                disabled={nonRefundable}
                className="input mt-1 num-mono"
              />
            </div>
          </div>
          <p className="text-[11px] text-ink-muted -mt-1">
            Blank amount = full refund within the window. Enter a figure for a partial refund.
          </p>

          {error && <div className="text-xs text-rust">{error}</div>}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setNonRefundable(false); setOpen(false) }}
              className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition"
            >
              <RotateCcw className="w-3 h-3" /> Discard
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button>
              <button type="submit" disabled={pending} className="btn-ink text-xs">
                {pending ? 'Saving…' : 'Save terms'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
