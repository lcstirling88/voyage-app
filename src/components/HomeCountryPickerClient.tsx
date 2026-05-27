'use client'

import { useState, useTransition } from 'react'
import { Home, Pencil, X, Check } from 'lucide-react'
import { setHomeCountry } from '@/lib/actions'

type Option = {
  isoNumeric: string
  label: string
  passportIcon?: string
}

/**
 * Small inline editor for the user's country of residence, sitting just
 * below the framed atlas on /profile. Default state reads as a museum
 * caption ("Based in 🇦🇺 Australia"). Tapping "Change" reveals a select.
 * Picking a value submits immediately so the map repaints in burgundy
 * without an extra confirmation step.
 */
export function HomeCountryPickerClient({
  options,
  currentIso,
  currentLabel,
  currentIcon,
}: {
  options: Option[]
  currentIso: string | null
  currentLabel: string | null
  currentIcon: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [iso, setIso] = useState(currentIso ?? '')
  const [pending, startTransition] = useTransition()

  function submit(nextIso: string) {
    const fd = new FormData()
    fd.set('isoNumeric', nextIso)
    startTransition(async () => {
      await setHomeCountry(fd)
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-muted">
        {currentIso && currentLabel ? (
          <>
            <Home className="w-3 h-3" style={{ color: '#6B2737' }} />
            <span>
              Based in{' '}
              <span className="text-ink">
                {currentIcon ? `${currentIcon} ` : ''}{currentLabel}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ulink inline-flex items-center gap-1 text-ink-muted hover:text-ink"
              aria-label="Change home country"
            >
              <Pencil className="w-2.5 h-2.5" />
              Change
            </button>
          </>
        ) : (
          <>
            <Home className="w-3 h-3 text-ink-muted" />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ulink text-ink-muted hover:text-ink"
            >
              Set where you live
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-muted">
      <Home className="w-3 h-3" style={{ color: '#6B2737' }} />
      <span className="normal-case tracking-normal text-xs">Where do you live?</span>
      <select
        className="input py-1 text-xs normal-case tracking-normal"
        value={iso}
        onChange={(e) => setIso(e.target.value)}
        disabled={pending}
      >
        <option value="">Not set</option>
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
        aria-label="Save home country"
      >
        <Check className="w-3 h-3" />
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => { setIso(currentIso ?? ''); setEditing(false) }}
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
