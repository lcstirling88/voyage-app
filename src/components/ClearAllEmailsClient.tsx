'use client'

import { useState, useTransition } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { clearAllEmails } from '@/lib/actions'

export function ClearAllEmailsClient({
  tripSlug, emailCount,
}: {
  tripSlug: string
  emailCount: number
}) {
  const [armed, setArmed] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [result, setResult] = useState<{ msg: string; ok: boolean } | null>(null)
  const [pending, startTransition] = useTransition()

  if (emailCount === 0) return null

  function go() {
    setResult(null)
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    startTransition(async () => {
      const res = await clearAllEmails(fd)
      if (res.ok) {
        setResult({
          ok: true,
          msg: `Removed ${res.deletedEmails} email${res.deletedEmails === 1 ? '' : 's'}, ${res.deletedBookings} booking${res.deletedBookings === 1 ? '' : 's'}, ${res.deletedDocuments} document${res.deletedDocuments === 1 ? '' : 's'}.`,
        })
        setArmed(false)
        setConfirmText('')
      } else {
        setResult({ ok: false, msg: res.error })
      }
    })
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs text-wine hover:bg-sakura-soft px-3 py-1.5 rounded-md border border-rust/30 inline-flex items-center gap-1.5 transition"
      >
        <Trash2 className="w-3.5 h-3.5" /> Clear all + reset
      </button>
    )
  }

  return (
    <div className="border border-rust/40 bg-sakura-soft/40 rounded-lg p-4 mt-3 max-w-md ml-auto">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-rust shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong className="text-wine">Reset the inbox?</strong> Deletes <strong>{emailCount}</strong> email{emailCount === 1 ? '' : 's'} + every booking/document they created. Manually-added bookings and payments are preserved.
        </div>
      </div>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="Type RESET to confirm"
        className="input text-sm"
        autoFocus
      />
      {result && (
        <div className={`text-xs mt-2 ${result.ok ? 'text-sage-dark' : 'text-rust'}`}>
          {result.ok ? '✓ ' : '× '}{result.msg}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={() => { setArmed(false); setConfirmText(''); setResult(null) }}
          className="btn-ghost text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={go}
          disabled={pending || confirmText !== 'RESET'}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-wine text-paper-pure disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5 hover:opacity-90"
        >
          <Trash2 className="w-3 h-3" /> {pending ? 'Resetting…' : 'Delete everything'}
        </button>
      </div>
    </div>
  )
}
