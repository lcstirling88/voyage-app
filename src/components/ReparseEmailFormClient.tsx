'use client'

import { useState, useTransition } from 'react'
import { Paperclip, X, RefreshCw } from 'lucide-react'
import { reparseEmailWithFiles } from '@/lib/actions'

/**
 * "Re-parse this email with extra files" form on the email detail page.
 * Lets the user drag in a PDF/image that didn't survive the original forward
 * and re-run Claude over the body + the uploaded files. Dedup in
 * persistParserResult means the existing booking is updated in place.
 */
export function ReparseEmailFormClient({ emailId }: { emailId: string }) {
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function handleFiles(picked: FileList | null) {
    if (!picked) return
    const arr = Array.from(picked)
    const cap = 25 * 1024 * 1024 // mirror the parser-side budget
    let total = files.reduce((s, f) => s + f.size, 0)
    const kept: File[] = []
    for (const f of arr) {
      if (total + f.size > cap) break
      kept.push(f)
      total += f.size
    }
    setFiles((prev) => [...prev, ...kept])
  }

  function remove(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    if (files.length === 0) return
    const fd = new FormData()
    fd.set('emailId', emailId)
    for (const f of files) fd.append('attachments', f)
    startTransition(async () => {
      const res = await reparseEmailWithFiles(fd)
      if (res.success && res.counts) {
        const c = res.counts
        setResult({
          ok: true,
          msg: `${res.summary ?? 'Re-parsed.'} (${c.bookings} booking${c.bookings === 1 ? '' : 's'}, ${c.documents} document${c.documents === 1 ? '' : 's'}, ${c.payments} payment${c.payments === 1 ? '' : 's'} from this re-parse.)`,
        })
        setFiles([])
      } else {
        setResult({ ok: false, msg: res.error ?? 'Re-parse failed.' })
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-xs px-3 py-2 border border-dashed border-line rounded-md cursor-pointer hover:bg-line-soft/40 transition">
          <Paperclip className="w-3.5 h-3.5" />
          <span>Add PDF / image / .ics</span>
          <input
            type="file"
            multiple
            accept=".pdf,application/pdf,image/jpeg,image/png,image/gif,image/webp,text/plain,text/calendar,text/csv,.ics"
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
          />
        </label>
        {files.map((f, i) => (
          <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 border border-line rounded-full bg-paper-pure">
            <Paperclip className="w-3 h-3 text-ink-muted" />
            <span className="max-w-[180px] truncate" title={f.name}>{f.name}</span>
            <span className="text-ink-muted text-[10px] num-mono">{(f.size / 1024).toFixed(0)}KB</span>
            <button type="button" onClick={() => remove(i)} className="text-ink-muted hover:text-rust ml-1" aria-label={`Remove ${f.name}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted italic">
          Itinera replays the parser over the original body plus these files. The existing booking updates in place — duplicates aren&apos;t created.
        </p>
        <button
          type="submit"
          disabled={pending || files.length === 0}
          className="text-xs px-3 py-1.5 rounded-md bg-ink text-paper-pure inline-flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
        >
          <RefreshCw className={`w-3 h-3 ${pending ? 'animate-spin' : ''}`} />
          {pending ? 'Re-parsing…' : 'Re-parse with files'}
        </button>
      </div>

      {result && (
        <div className={`text-xs ${result.ok ? 'text-sage-dark' : 'text-rust'}`}>
          {result.ok ? '✓ ' : '× '}{result.msg}
        </div>
      )}
    </form>
  )
}
