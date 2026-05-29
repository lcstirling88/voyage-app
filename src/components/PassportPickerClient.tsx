'use client'

import { useState, useTransition } from 'react'
import { BookUser, Pencil, X, Check } from 'lucide-react'
import { setPassport } from '@/lib/actions'

type Option = {
  isoNumeric: string
  label: string
  passportIcon?: string
}

/**
 * Inline passport / nationality editor on the profile, next to the home
 * country. Drives per-destination visa rules. Defaults to the user's home
 * country (shown as "same as home") until they explicitly set a different
 * passport — covering e.g. a British-passport holder living in Australia.
 */
export function PassportPickerClient({
  options,
  passportIso,
  homeIso,
}: {
  options: Option[]
  /** Explicitly-set passport ISO, or null (then falls back to home). */
  passportIso: string | null
  /** Home-country ISO used as the fallback default. */
  homeIso: string | null
}) {
  const effectiveIso = passportIso ?? homeIso
  const effective = effectiveIso ? options.find((o) => o.isoNumeric === effectiveIso) : null
  const derivedFromHome = !passportIso && !!homeIso

  const [editing, setEditing] = useState(false)
  const [iso, setIso] = useState(passportIso ?? homeIso ?? '')
  const [pending, startTransition] = useTransition()

  function submit(nextIso: string) {
    const fd = new FormData()
    fd.set('isoNumeric', nextIso)
    startTransition(async () => {
      await setPassport(fd)
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-muted">
        <BookUser className="w-3 h-3 text-sage" />
        {effective ? (
          <span>
            Passport{' '}
            <span className="text-ink">
              {effective.passportIcon ? `${effective.passportIcon} ` : ''}{effective.label}
            </span>
            {derivedFromHome && <span className="text-ink-muted/70"> · same as home</span>}
          </span>
        ) : (
          <span>Passport not set</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ulink inline-flex items-center gap-1 text-ink-muted hover:text-ink"
          aria-label="Change passport"
        >
          <Pencil className="w-2.5 h-2.5" />
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-muted">
      <BookUser className="w-3 h-3 text-sage" />
      <span className="normal-case tracking-normal text-xs">Passport you travel on?</span>
      <select
        className="input py-1 text-xs normal-case tracking-normal"
        value={iso}
        onChange={(e) => setIso(e.target.value)}
        disabled={pending}
      >
        <option value="">Same as home</option>
        {options.map((o) => (
          <option key={o.isoNumeric} value={o.isoNumeric}>
            {o.passportIcon ? `${o.passportIcon} ` : ''}{o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => submit(iso)}
        disabled={pending}
        className="ulink inline-flex items-center gap-1 text-sage hover:text-ink disabled:opacity-40"
        aria-label="Save passport"
      >
        <Check className="w-3 h-3" />
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => { setIso(passportIso ?? homeIso ?? ''); setEditing(false) }}
        disabled={pending}
        className="ulink inline-flex items-center gap-1 text-ink-muted hover:text-rust"
        aria-label="Cancel"
      >
        <X className="w-3 h-3" />
        Cancel
      </button>
    </div>
  )
}
