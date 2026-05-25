'use client'

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { addPaymentManually } from '@/lib/actions'

export function AddPaymentFormClient({
  tripSlug,
  homeCurrency,
  localCurrency,
}: {
  tripSlug: string
  homeCurrency: string
  localCurrency: string | null
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('tripSlug', tripSlug)
    startTransition(async () => {
      const res = await addPaymentManually(fd)
      if (res.ok) setOpen(false)
      else setError(res.error)
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-2 border border-dashed border-line rounded-md text-ink-muted hover:border-sage hover:text-sage transition flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" /> Add a payment manually
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="border border-line rounded-lg bg-paper-pure p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Add a payment</div>
        <button type="button" onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink p-1" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <input
        name="description"
        autoFocus
        required
        placeholder="e.g. Travel insurance excess"
        className="input"
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Amount *</label>
          <input name="amount" type="number" step="0.01" min="0.01" required className="input mt-1 num-mono" placeholder="0.00" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Currency</label>
          <select name="currency" defaultValue={homeCurrency} className="input mt-1 num-mono">
            <option value={homeCurrency}>{homeCurrency}</option>
            {localCurrency && localCurrency !== homeCurrency && <option value={localCurrency}>{localCurrency}</option>}
            {['USD', 'EUR', 'GBP'].filter((c) => c !== homeCurrency && c !== localCurrency).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Due date *</label>
          <input name="dueDate" type="date" required className="input mt-1 num-mono" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Payment method</label>
          <input name="paymentMethod" placeholder="Amex 4019" className="input mt-1" />
        </div>
      </div>

      <div className="flex gap-4 text-xs">
        <label className="flex gap-2 items-center">
          <input type="checkbox" name="autoPay" className="accent-sage" /> Auto-pay
        </label>
        <label className="flex gap-2 items-center">
          <input type="checkbox" name="paid" className="accent-sage" /> Already paid
        </label>
      </div>

      {error && <div className="text-xs text-rust">{error}</div>}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button>
        <button type="submit" disabled={pending} className="btn-ink text-xs">
          {pending ? 'Adding…' : 'Add payment'}
        </button>
      </div>
    </form>
  )
}
