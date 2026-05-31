'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Trash2 } from 'lucide-react'
import { editBooking, deleteBooking, type EditBookingResult } from '@/lib/actions'

const TYPE_OPTIONS = [
  { value: 'activity',   label: 'Activity' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'transit',    label: 'Transit' },
  { value: 'flight',     label: 'Flight' },
  { value: 'car',        label: 'Car hire' },
  { value: 'hotel',      label: 'Hotel' },
  { value: 'other',      label: 'Other' },
]

const CURRENCIES = ['AUD', 'NZD', 'USD', 'GBP', 'EUR', 'JPY', 'SGD', 'CAD', 'THB', 'IDR']

type Initial = {
  id: string
  tripSlug: string
  type: string
  title: string
  vendor: string | null
  date: string         // YYYY-MM-DD
  time: string         // HH:MM
  endDate: string
  endTime: string
  location: string | null
  address: string | null
  confirmationCode: string | null
  notes: string | null
  cost: string         // numeric string
  currency: string
  paid: boolean
  paymentMethod: string | null
  cancelDate: string
  cancelTime: string
  cancellationPolicy: string | null
  checkIn: string
  checkOut: string
  breakfast: string
  flightNumber: string
  airline: string
  departureAirport: string
  arrivalAirport: string
  terminal: string
  gate: string
  seat: string
  cabin: string
}

export function BookingEditFormClient({ initial }: { initial: Initial }) {
  const router = useRouter()
  const [type, setType] = useState(initial.type)
  const [error, setError] = useState<string | null>(null)
  const [savePending, startSaveTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('id', initial.id)
    startSaveTransition(async () => {
      const res = (await editBooking(fd)) as EditBookingResult
      if (res.ok) router.push(`/trips/${res.tripSlug}/itinerary`)
      else setError(res.error)
    })
  }

  function remove() {
    if (!confirm('Delete this booking? This can\'t be undone.')) return
    const fd = new FormData()
    fd.set('id', initial.id)
    fd.set('tripSlug', initial.tripSlug)
    startDeleteTransition(async () => {
      await deleteBooking(fd)
      router.push(`/trips/${initial.tripSlug}/itinerary`)
    })
  }

  const isHotel = type === 'hotel'
  const isFlight = type === 'flight'

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div className="col-span-1 sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Title *</label>
          <input name="title" defaultValue={initial.title} required className="input mt-1.5 text-xl font-display" />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Type</label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input mt-1.5">
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Vendor</label>
          <input name="vendor" defaultValue={initial.vendor ?? ''} className="input mt-1.5" placeholder="e.g. Apex Car Rentals" />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">{isHotel ? 'Check-in date *' : 'Start date *'}</label>
          <input name="date" type="date" required defaultValue={initial.date} className="input mt-1.5 num-mono" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">{isHotel ? 'Check-in time' : 'Start time'}</label>
          <input name="time" type="time" defaultValue={initial.time} className="input mt-1.5 num-mono" />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">{isHotel ? 'Check-out date' : 'End date'}</label>
          <input name="endDate" type="date" defaultValue={initial.endDate} className="input mt-1.5 num-mono" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">{isHotel ? 'Check-out time' : 'End time'}</label>
          <input name="endTime" type="time" defaultValue={initial.endTime} className="input mt-1.5 num-mono" />
        </div>

        <div className="col-span-1 sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Location</label>
          <input name="location" defaultValue={initial.location ?? ''} className="input mt-1.5" placeholder="City or neighbourhood" />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Address</label>
          <input name="address" defaultValue={initial.address ?? ''} className="input mt-1.5" placeholder="Full address" />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Confirmation</label>
          <input name="confirmationCode" defaultValue={initial.confirmationCode ?? ''} className="input mt-1.5 num-mono" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Payment method</label>
          <input name="paymentMethod" defaultValue={initial.paymentMethod ?? ''} className="input mt-1.5" />
        </div>

        <div className="grid grid-cols-3 gap-2 col-span-1 sm:col-span-2">
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Cost</label>
            <input name="cost" type="number" step="0.01" defaultValue={initial.cost} className="input mt-1.5 num-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Currency</label>
            <select name="currency" defaultValue={initial.currency} className="input mt-1.5 num-mono">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="col-span-1 sm:col-span-2 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="paid" defaultChecked={initial.paid} className="accent-sage" /> Marked as paid
          </label>
        </div>

        <div className="col-span-1 sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Notes</label>
          <textarea name="notes" defaultValue={initial.notes ?? ''} rows={3} className="input mt-1.5" />
        </div>
      </section>

      {isHotel && (
        <section className="border border-line rounded-xl bg-paper/50 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">Hotel details</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Check-in time text</label>
              <input name="checkIn" defaultValue={initial.checkIn} className="input mt-1.5" placeholder="e.g. 3:00 PM" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Check-out time text</label>
              <input name="checkOut" defaultValue={initial.checkOut} className="input mt-1.5" placeholder="e.g. 11:00 AM" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Breakfast</label>
              <input name="breakfast" defaultValue={initial.breakfast} className="input mt-1.5" placeholder="Included / Extra / —" />
            </div>
          </div>
        </section>
      )}

      {isFlight && (
        <section className="border border-line rounded-xl bg-paper/50 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-1">Flight details</div>
          <p className="text-[11px] text-ink-muted mb-3">
            The flight number plus airport codes power live delay &amp; cancellation tracking on the day you fly.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Flight no.</label>
              <input name="flightNumber" defaultValue={initial.flightNumber} className="input mt-1.5 num-mono" placeholder="QF25" />
            </div>
            <div className="col-span-1 sm:col-span-3">
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Airline</label>
              <input name="airline" defaultValue={initial.airline} className="input mt-1.5" placeholder="Qantas" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">From (code)</label>
              <input name="departureAirport" defaultValue={initial.departureAirport} className="input mt-1.5 num-mono" placeholder="SYD" maxLength={4} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">To (code)</label>
              <input name="arrivalAirport" defaultValue={initial.arrivalAirport} className="input mt-1.5 num-mono" placeholder="HND" maxLength={4} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Terminal</label>
              <input name="terminal" defaultValue={initial.terminal} className="input mt-1.5" placeholder="1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Gate</label>
              <input name="gate" defaultValue={initial.gate} className="input mt-1.5" placeholder="B12" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Seat</label>
              <input name="seat" defaultValue={initial.seat} className="input mt-1.5 num-mono" placeholder="32A" />
            </div>
            <div className="col-span-1 sm:col-span-3">
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Cabin / class</label>
              <input name="cabin" defaultValue={initial.cabin} className="input mt-1.5" placeholder="Economy" />
            </div>
          </div>
        </section>
      )}

      <section className="border border-line rounded-xl bg-paper/50 p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">Cancellation</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Free-cancel by date</label>
            <input name="cancelDate" type="date" defaultValue={initial.cancelDate} className="input mt-1.5 num-mono" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Time</label>
            <input name="cancelTime" type="time" defaultValue={initial.cancelTime} className="input mt-1.5 num-mono" />
          </div>
          <div className="sm:col-span-1">
            <label className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Policy summary</label>
            <input name="cancellationPolicy" defaultValue={initial.cancellationPolicy ?? ''} className="input mt-1.5" placeholder="Free up to 48hr before…" />
          </div>
        </div>
      </section>

      {error && (
        <div className="border border-rust bg-sakura-soft rounded-lg p-3 text-sm">{error}</div>
      )}

      <div className="flex items-center justify-between border-t border-line pt-6">
        <button type="button" onClick={remove} disabled={deletePending} className="text-sm text-wine hover:underline inline-flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" /> {deletePending ? 'Deleting…' : 'Delete booking'}
        </button>
        <button type="submit" disabled={savePending} className="btn-ink">
          {savePending ? 'Saving…' : <>Save changes <Save className="w-4 h-4" /></>}
        </button>
      </div>
    </form>
  )
}
