import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Mail, AlertTriangle, Check, Clock, Paperclip, FileText, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { InlineDeleteButton } from '@/components/InlineDeleteButton'
import { ReparseEmailFormClient } from '@/components/ReparseEmailFormClient'

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ tripSlug: string; emailId: string }>
}) {
  const { tripSlug, emailId } = await params
  await requireTripAccess(tripSlug)

  const email = await prisma.incomingEmail.findUnique({
    where: { id: emailId },
    include: {
      trip: true,
      bookings: { select: { id: true, title: true, type: true, startAt: true } },
      documents: { select: { id: true, title: true, category: true } },
      attachments: { select: { id: true, filename: true, mimeType: true, size: true, storagePath: true } },
    },
  })
  if (!email || email.trip?.slug !== tripSlug) notFound()

  // Heuristic: did the body mention an attachment? If so and none came through,
  // surface a hint — most often the user's email client stripped it on Forward.
  const bodyForCheck = (email.textBody ?? '').toLowerCase() + ' ' + (email.parsedSummary ?? '').toLowerCase()
  const bodyMentionsAttachment = /\b(attached|attachment|see (the )?pdf|e-ticket|itinerary receipt)\b/.test(bodyForCheck)
  const missingAttachments = email.attachments.length === 0 && bodyMentionsAttachment

  type ParsedShape = {
    summary?: string
    bookings?: Array<Record<string, unknown>>
    documents?: Array<Record<string, unknown>>
    payments?: Array<Record<string, unknown>>
    mode?: string
  }
  let parsed: ParsedShape | null = null
  try { parsed = email.parsedJson ? (JSON.parse(email.parsedJson) as ParsedShape) : null } catch { /* ignore */ }

  return (
    <>
      <div className="hero-light border-b border-line">
        <div className="px-6 sm:px-10 py-8 sm:py-10 max-w-4xl">
          <Link
            href={`/trips/${tripSlug}/inbox`}
            className="text-xs text-ink-muted inline-flex items-center gap-1 ulink mb-6"
          >
            <ChevronLeft className="w-3 h-3" /> Back to inbox
          </Link>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted flex items-center gap-2">
            <Mail className="w-3 h-3" />
            <span>{format(email.receivedAt, 'EEE MMM d, HH:mm')}</span>
            <span className="opacity-50">·</span>
            <span className="truncate">{email.fromAddress}</span>
          </div>
          <h1 className="h-display text-2xl sm:text-4xl mt-2 break-words">{email.subject}</h1>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {email.errorMsg ? (
              <span className="pill pill-overdue"><AlertTriangle className="w-3 h-3" /> Error</span>
            ) : email.processed ? (
              <span className="pill pill-paid"><Check className="w-3 h-3" /> Parsed</span>
            ) : (
              <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> Pending</span>
            )}
            {parsed?.mode && (
              <span className="pill pill-info">Parser: {parsed.mode}</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-10 py-8 sm:py-12 max-w-4xl space-y-8">

        {/* Parser summary */}
        {parsed?.summary && (
          <section className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">Parser summary</div>
            <p className="text-sm italic">{parsed.summary}</p>
          </section>
        )}

        {/* Error */}
        {email.errorMsg && (
          <section className="border border-rust/40 bg-sakura-soft/40 rounded-xl p-5 sm:p-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-wine mb-2">Parser error</div>
            <pre className="text-xs whitespace-pre-wrap text-wine font-mono">{email.errorMsg}</pre>
          </section>
        )}

        {/* What this email created */}
        {(email.bookings.length > 0 || email.documents.length > 0) && (
          <section className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">Created from this email</div>
            <div className="space-y-2 text-sm">
              {email.bookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/trips/${tripSlug}/booking/${b.id}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded hover:bg-line-soft transition"
                >
                  <span className="pill pill-info text-[9px]">{b.type}</span>
                  <span className="flex-1 min-w-0 truncate">{b.title}</span>
                  <span className="text-xs text-ink-muted shrink-0 num-mono">{format(b.startAt, 'MMM d')}</span>
                </Link>
              ))}
              {email.documents.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-2 -mx-2">
                  <span className="pill pill-info text-[9px]">{d.category}</span>
                  <span className="flex-1 min-w-0 truncate">{d.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Email body */}
        <section className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">Original email</div>
          {email.textBody ? (
            <pre className="text-xs sm:text-sm whitespace-pre-wrap text-ink-soft leading-relaxed font-mono max-h-[60vh] overflow-y-auto">
              {email.textBody}
            </pre>
          ) : email.htmlBody ? (
            <div className="text-xs text-ink-muted italic">
              This email only has an HTML body — not previewable inline yet. Parser still saw it.
            </div>
          ) : (
            <div className="text-xs text-ink-muted italic">No body content stored.</div>
          )}
        </section>

        {/* Attachments received */}
        <section className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted flex items-center gap-2">
              <Paperclip className="w-3 h-3" />
              <span>Attachments received · {email.attachments.length}</span>
            </div>
          </div>
          {email.attachments.length === 0 ? (
            <div className={`text-xs ${missingAttachments ? 'text-wine' : 'text-ink-muted'} italic`}>
              {missingAttachments ? (
                <>
                  ⚠ The email body refers to an attachment, but none came through. Your email client may have stripped it on Forward
                  (iOS Mail, Gmail mobile, and some other apps do this silently — look for an &quot;Include attachments&quot; toggle).
                  Upload the file below to re-parse without re-forwarding.
                </>
              ) : (
                <>No attachments came with this email.</>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {email.attachments.map((a) => {
                const hasFile = Boolean(a.storagePath)
                const inner = (
                  <>
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${hasFile ? 'text-sage' : 'text-ink-muted'}`} />
                    <span className={`flex-1 min-w-0 truncate ${hasFile ? 'group-hover:text-sage' : ''}`}>{a.filename}</span>
                    <span className="text-[10px] num-mono text-ink-muted shrink-0 hidden sm:inline">{a.mimeType}</span>
                    <span className="text-[10px] num-mono text-ink-muted shrink-0">{(a.size / 1024).toFixed(0)}KB</span>
                    {hasFile && <ExternalLink className="w-3.5 h-3.5 text-ink-muted/60 group-hover:text-sage shrink-0" />}
                  </>
                )
                return hasFile ? (
                  <li key={a.id}>
                    <a
                      href={a.storagePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 -mx-2 px-2 py-1 rounded hover:bg-line-soft/40 transition"
                    >
                      {inner}
                    </a>
                  </li>
                ) : (
                  <li key={a.id} className="flex items-center gap-3">{inner}</li>
                )
              })}
            </ul>
          )}

          <div className="mt-4 pt-4 border-t border-line">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-3">Re-parse with extra files</div>
            <ReparseEmailFormClient emailId={email.id} />
          </div>
        </section>

        {/* Parsed JSON */}
        {parsed && (
          <details className="border border-line rounded-xl bg-paper-pure">
            <summary className="px-5 sm:px-6 py-3 cursor-pointer text-[10px] uppercase tracking-[0.18em] text-ink-muted hover:bg-line-soft/40 rounded-xl">
              Parsed JSON (what Claude extracted)
            </summary>
            <pre className="px-5 sm:px-6 pb-5 text-xs font-mono text-ink-soft whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </details>
        )}

        {/* Danger zone */}
        <section className="border border-rust/30 bg-sakura-soft/30 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-wine mb-1">Delete this email</div>
            <p className="text-xs text-ink-soft">Also removes any booking or document this email created.</p>
          </div>
          <InlineDeleteButton kind="email" id={email.id} tripSlug={tripSlug} label="Delete email" size="md" />
        </section>
      </div>
    </>
  )
}
