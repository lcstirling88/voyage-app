'use client'

import { useState, useTransition } from 'react'
import { Wand2, RefreshCw, ShieldCheck } from 'lucide-react'
import { generateVisaInfo } from '@/lib/actions'

export function GenerateVisaInfoClient({
  tripSlug, regenerate = false,
}: {
  tripSlug: string
  regenerate?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function go() {
    setError(null)
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    startTransition(async () => {
      const res = await generateVisaInfo(fd)
      if (!res.ok) setError(res.error)
    })
  }

  if (regenerate) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button onClick={go} disabled={pending} className="text-xs text-ink-muted hover:text-sage inline-flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${pending ? 'animate-spin' : ''}`} />
          {pending ? 'Refreshing…' : 'Refresh'}
        </button>
        {error && <div className="text-xs text-rust">{error}</div>}
      </div>
    )
  }

  return (
    <div className="border-2 border-dashed border-line rounded-xl bg-paper/40 p-6 text-center">
      <ShieldCheck className="w-6 h-6 mx-auto mb-3 text-sage" />
      <h3 className="font-display text-xl">Check entry requirements</h3>
      <p className="text-sm text-ink-muted mt-1 max-w-md mx-auto">
        Generate visa &amp; entry rules for your passport, for each country on this trip. Takes ~10 seconds.
      </p>
      <button onClick={go} disabled={pending} className="btn-ink mt-4 inline-flex">
        {pending ? 'Generating…' : <>Generate with AI <Wand2 className="w-4 h-4" /></>}
      </button>
      {error && <div className="mt-3 text-sm text-rust">{error}</div>}
    </div>
  )
}
