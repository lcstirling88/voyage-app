import { notFound } from 'next/navigation'
import { Mail, Copy, Inbox as InboxIcon } from 'lucide-react'
import { prisma } from '@/lib/db'
import { PasteEmailFormClient } from '@/components/PasteEmailFormClient'
import { InlineDeleteButton } from '@/components/InlineDeleteButton'
import { fmtDate } from '@/lib/format'

const inboxDomain = process.env.NEXT_PUBLIC_INBOX_DOMAIN ?? 'voyage.local'

export default async function InboxPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({ where: { slug: tripSlug } })
  if (!trip) notFound()

  const emails = await prisma.incomingEmail.findMany({
    where: { tripId: trip.id },
    orderBy: { receivedAt: 'desc' },
    take: 20,
  })

  const inboxAddress = `inbox+${trip.inboxToken}@${inboxDomain}`

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Inbox</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Forward your bookings.</h1>
        <p className="text-ink-muted mt-3 max-w-2xl text-sm sm:text-base">
          Forward any confirmation, voucher, or itinerary email. Voyage parses, files, and updates your itinerary.
        </p>

        <div className="mt-6 flex items-center gap-3 px-3 sm:px-4 py-2 sm:py-3 bg-paper-pure border border-line rounded-lg max-w-full overflow-hidden">
          <Mail className="w-4 h-4 text-sage shrink-0" />
          <code className="num-mono text-xs sm:text-sm break-all">{inboxAddress}</code>
          <button className="text-ink-muted hover:text-ink shrink-0" title="Copy"><Copy className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <section className="lg:col-span-2 border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-display text-2xl">Test the parser</h2>
            <span className="text-xs text-ink-muted">Paste any booking email to see it parsed and filed</span>
          </div>
          <PasteEmailFormClient tripSlug={trip.slug} />
        </section>

        <aside>
          <h2 className="font-display text-2xl mb-4">How email forwarding works</h2>
          <ol className="space-y-3 text-sm text-ink-soft">
            <li className="flex gap-3">
              <span className="font-display text-2xl text-sage leading-none">1</span>
              <div><strong>Each trip gets a unique address</strong> ({inboxAddress}). The token after the <code className="num-mono">+</code> identifies which trip the email belongs to.</div>
            </li>
            <li className="flex gap-3">
              <span className="font-display text-2xl text-sage leading-none">2</span>
              <div><strong>Inbound email service routes it</strong> — Postmark, Resend, or SendGrid receive mail at <code className="num-mono">@{inboxDomain}</code> and POST a JSON payload to <code className="num-mono">/api/email/inbound</code>.</div>
            </li>
            <li className="flex gap-3">
              <span className="font-display text-2xl text-sage leading-none">3</span>
              <div><strong>Claude extracts the structure</strong> — using forced tool-use, with a fallback mock parser when no API key is set.</div>
            </li>
            <li className="flex gap-3">
              <span className="font-display text-2xl text-sage leading-none">4</span>
              <div><strong>Bookings, documents, and payments appear instantly</strong> in your itinerary tabs. The original email and attachments are kept for reference.</div>
            </li>
          </ol>

          <div className="mt-6 border-t border-line pt-6">
            <h3 className="font-display text-lg mb-2">To turn on real forwarding</h3>
            <ol className="text-xs text-ink-muted space-y-1 list-decimal list-inside">
              <li>Buy a domain (or use a subdomain).</li>
              <li>Sign up for Postmark Inbound (≈US$15/mo).</li>
              <li>Set MX records to Postmark&apos;s servers.</li>
              <li>Point Postmark&apos;s Inbound Webhook URL at your deployed <code className="num-mono">/api/email/inbound</code>.</li>
              <li>Set <code className="num-mono">NEXT_PUBLIC_INBOX_DOMAIN</code> to your domain in <code className="num-mono">.env.local</code>.</li>
            </ol>
          </div>
        </aside>

        <section className="lg:col-span-3 border border-line rounded-xl bg-paper-pure overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-line flex items-center gap-3">
            <InboxIcon className="w-4 h-4 text-ink-muted" />
            <h2 className="font-display text-xl sm:text-2xl flex-1">Recent emails</h2>
            <span className="text-xs text-ink-muted">{emails.length} total</span>
          </div>
          {emails.length === 0 ? (
            <div className="px-6 py-16 text-center text-ink-muted">
              <Mail className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <div className="text-sm">No emails yet. Paste a sample above to see the parser in action.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                <tr className="border-b border-line">
                  <th className="text-left px-6 py-3 font-medium">Received</th>
                  <th className="text-left px-6 py-3 font-medium">From</th>
                  <th className="text-left px-6 py-3 font-medium">Subject</th>
                  <th className="text-left px-6 py-3 font-medium">Parser summary</th>
                  <th className="text-right px-6 py-3 font-medium">Status</th>
                  <th className="text-right px-6 py-3 font-medium pr-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {emails.map((e) => (
                  <tr key={e.id} className="hover:bg-line-soft/40">
                    <td className="px-6 py-3 num-mono text-xs text-ink-muted">{fmtDate(e.receivedAt, 'MMM d, HH:mm')}</td>
                    <td className="px-6 py-3 text-ink-muted">{e.fromAddress}</td>
                    <td className="px-6 py-3 font-medium">{e.subject}</td>
                    <td className="px-6 py-3 text-ink-muted italic">{e.parsedSummary ?? '—'}</td>
                    <td className="px-6 py-3 text-right">
                      {e.errorMsg ? (
                        <span className="pill pill-overdue">Error</span>
                      ) : e.processed ? (
                        <span className="pill pill-paid">Parsed</span>
                      ) : (
                        <span className="pill pill-upcoming">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right pr-6">
                      <InlineDeleteButton kind="email" id={e.id} tripSlug={trip.slug} label="Delete email" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
