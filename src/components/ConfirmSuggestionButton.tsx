'use client'

/**
 * "Keep" button on an AI-suggested itinerary card — promotes the suggestion to
 * a real booking (server action strips the __suggested flag), so it stops
 * rendering as a dashed placeholder. Non-destructive, so single-click (unlike
 * the two-step delete).
 */

import { useTransition } from 'react'
import { Check } from 'lucide-react'
import { confirmSuggestion } from '@/lib/actions'

export function ConfirmSuggestionButton({ id, tripSlug }: { id: string; tripSlug: string }) {
  const [pending, startTransition] = useTransition()

  function click(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const fd = new FormData()
    fd.set('id', id)
    fd.set('tripSlug', tripSlug)
    startTransition(async () => { await confirmSuggestion(fd) })
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] transition text-ink-muted hover:bg-sage-soft hover:text-sage-dark"
      title="Keep this — mark as planned"
    >
      <Check className="w-3 h-3" />
      {pending ? '…' : 'Keep'}
    </button>
  )
}
