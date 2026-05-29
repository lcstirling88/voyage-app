'use client'

/**
 * "Swap" button on an AI-suggested itinerary card — asks Itinera for a fresh
 * alternative in the same day / session / city, honouring the preferences the
 * plan was built with. Replaces the suggestion in place. Lives on a card that
 * is itself a link, so clicks are stopped from bubbling.
 */

import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { swapSuggestion } from '@/lib/actions'

export function SwapSuggestionButton({ id, tripSlug }: { id: string; tripSlug: string }) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState(false)

  function click(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setErr(false)
    const fd = new FormData()
    fd.set('id', id)
    fd.set('tripSlug', tripSlug)
    startTransition(async () => {
      const res = await swapSuggestion(fd)
      if (!res.ok) setErr(true)
    })
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] transition ${
        err ? 'text-rust hover:bg-rust/10' : 'text-ink-muted hover:bg-sage-soft hover:text-sage-dark'
      }`}
      title={err ? 'Could not swap — try again' : 'Swap for a different idea'}
    >
      <RefreshCw className={`w-3 h-3 ${pending ? 'animate-spin' : ''}`} />
      {pending ? '…' : err ? 'Try again' : 'Swap'}
    </button>
  )
}
