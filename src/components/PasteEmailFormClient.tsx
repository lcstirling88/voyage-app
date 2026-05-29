'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Send, Paperclip, X } from 'lucide-react'
import { ingestPastedEmail } from '@/lib/actions'

// Destination-neutral test fixtures for the parser — realistic confirmation
// emails that don't assume any particular country.
const samples: { label: string; from: string; subject: string; body: string }[] = [
  {
    label: 'Hotel confirmation',
    from: 'reservations@grandharbourhotel.com',
    subject: 'Booking confirmation — Grand Harbour Hotel · 3 nights',
    body: `Dear Mr Christiansen,

We're delighted to confirm your reservation at Grand Harbour Hotel.

Check-in: Friday, June 19, 2026 at 3:00 PM
Check-out: Monday, June 22, 2026 at 11:00 AM
Nights: 3
Room: Harbour View King
Guests: 2 adults
Breakfast: Included

Confirmation number: GHH-204-8851-LC
Total: AUD 720 (paid in full at booking)

Address: 14 Marine Parade, Waterfront District
We look forward to welcoming you.`,
  },
  {
    label: 'Flight itinerary',
    from: 'noreply@qantas.com',
    subject: 'Your Qantas booking — QF121 BNE–AKL — confirmed',
    body: `Booking reference: 7HK3PQ

Outbound — Qantas QF121
Brisbane (BNE) → Auckland (AKL)
Depart: June 17, 2026 at 09:35
Arrive: June 17, 2026 at 15:50
Aircraft: Boeing 737
Seats: 14A, 14B
Baggage: 1 x 23kg checked

Total: AUD 1,240 (paid)`,
  },
  {
    label: 'Restaurant reservation',
    from: 'no-reply@tablecheck.com',
    subject: 'Reservation confirmed — The Waterfront Grill · table for 2',
    body: `Your reservation is confirmed.

Restaurant: The Waterfront Grill
Date: Saturday June 20, 2026
Time: 19:00
Party size: 2
Booking ID: TC-44892
Cancellation: 24 hours
Note: Mains around AUD 45.`,
  },
]

export function PasteEmailFormClient({ tripSlug }: { tripSlug: string }) {
  const [from, setFrom] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [result, setResult] = useState<{ ok: boolean; msg: string; mode?: string; counts?: { bookings: number; documents: number; payments: number } } | null>(null)
  const [pending, startTransition] = useTransition()

  function loadSample(s: typeof samples[number]) {
    setFrom(s.from)
    setSubject(s.subject)
    setBody(s.body)
    setResult(null)
  }

  function handleFiles(files: FileList | null) {
    if (!files) return
    const arr = Array.from(files)
    // 25MB total cap mirrors the parser's per-email budget
    const cap = 25 * 1024 * 1024
    let total = attachments.reduce((s, f) => s + f.size, 0)
    const kept: File[] = []
    for (const f of arr) {
      if (total + f.size > cap) break
      kept.push(f)
      total += f.size
    }
    setAttachments((prev) => [...prev, ...kept])
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('from', from)
    fd.set('subject', subject)
    fd.set('body', body)
    for (const f of attachments) fd.append('attachments', f)
    startTransition(async () => {
      const res = await ingestPastedEmail(fd)
      if (res.error) {
        setResult({ ok: false, msg: res.error })
      } else if (res.success) {
        setResult({
          ok: true,
          msg: res.summary,
          mode: res.parserMode,
          counts: res.counts,
        })
        setFrom(''); setSubject(''); setBody(''); setAttachments([])
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2 text-xs flex-wrap">
        <span className="text-ink-muted self-center mr-1">Load sample:</span>
        {samples.map((s) => (
          <button key={s.label} type="button" onClick={() => loadSample(s)} className="px-3 py-1.5 border border-line rounded-full hover:bg-line-soft">
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">From</label>
          <input className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="reservations@hotel.com" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Subject</label>
          <input className="input mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Booking confirmation — …" />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Body</label>
        <textarea
          className="input mt-1 font-mono text-xs"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste the email body here…"
        />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Attachments <span className="opacity-60 normal-case tracking-normal">— PDFs, tickets, ticket photos, .ics, etc.</span></label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs px-3 py-2 border border-dashed border-line rounded-md cursor-pointer hover:bg-line-soft/40 transition">
            <Paperclip className="w-3.5 h-3.5" />
            <span>Add file</span>
            <input
              type="file"
              multiple
              accept=".pdf,application/pdf,image/jpeg,image/png,image/gif,image/webp,text/plain,text/calendar,text/csv,.ics"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
            />
          </label>
          {attachments.map((f, i) => (
            <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 border border-line rounded-full bg-paper-pure">
              <Paperclip className="w-3 h-3 text-ink-muted" />
              <span className="max-w-[180px] truncate" title={f.name}>{f.name}</span>
              <span className="text-ink-muted text-[10px] num-mono">{(f.size / 1024).toFixed(0)}KB</span>
              <button type="button" onClick={() => removeAttachment(i)} className="text-ink-muted hover:text-rust ml-1" aria-label={`Remove ${f.name}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-ink-muted">
          {process.env.NEXT_PUBLIC_HAS_API_KEY === '1'
            ? <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-sage" /> Live Claude parsing</span>
            : 'Mock parser will be used unless ANTHROPIC_API_KEY is set in .env.local'}
        </div>
        <button type="submit" disabled={pending || (!body.trim() && attachments.length === 0)} className="btn-ink">
          {pending ? 'Parsing…' : <>Send to parser <Send className="w-3.5 h-3.5" /></>}
        </button>
      </div>

      {result && (
        <div className={`mt-4 border rounded-lg p-4 ${result.ok ? 'border-sage bg-sage-soft' : 'border-rust bg-sakura-soft'}`}>
          <div className="text-sm font-medium">{result.ok ? '✓ Parsed' : '× Error'}</div>
          <div className="text-sm text-ink-soft mt-1">{result.msg}</div>
          {result.ok && result.counts && (
            <div className="text-xs text-ink-muted mt-2">
              Created {result.counts.bookings} booking(s), {result.counts.documents} document(s), {result.counts.payments} payment(s).
              {result.mode === 'mock' && <span className="ml-2 italic">(Mock parser — drop an Anthropic API key in .env.local for real parsing.)</span>}
            </div>
          )}
        </div>
      )}
    </form>
  )
}
