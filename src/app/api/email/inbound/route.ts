/**
 * Inbound email webhook.
 *
 * Accepts a Postmark-compatible JSON payload (Resend & SendGrid are very similar — adapter
 * is at the top of the handler so swapping providers is a few lines).
 *
 * Routing: emails are addressed inbox+{token}@your-domain.com. We pull the token from the
 * `+`-tag and look up the corresponding Trip. Unknown tokens get a 200 + log so the email
 * service stops retrying — we don't want bounces hitting senders.
 *
 * Configure in Postmark: Servers → Inbound Stream → Webhook URL.
 *
 * For local testing, the `/trips/[slug]/inbox` page POSTs to the same parser via a
 * server action, so you don't need a real email service to exercise the parser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseEmail, type EmailInput } from '@/lib/email-parser'
import { persistParserResult } from '@/lib/ingest'

type PostmarkAttachment = {
  Name: string
  ContentType: string
  Content: string // base64
  ContentLength: number
}

type PostmarkInbound = {
  From: string
  To: string
  Subject: string
  TextBody?: string
  HtmlBody?: string
  Date?: string
  Attachments?: PostmarkAttachment[]
}

function extractTripToken(to: string): string | null {
  // inbox+token@domain  -> token
  const m = to.match(/^[^+]+\+([^@]+)@/i)
  return m?.[1] ?? null
}

export async function POST(req: NextRequest) {
  // Shared-secret check — when INBOUND_WEBHOOK_SECRET is set in env, require it
  // in the X-Webhook-Secret header. This stops random people from POSTing fake
  // bookings into your trips. Disabled when the env var is unset (local dev).
  const expectedSecret = process.env.INBOUND_WEBHOOK_SECRET
  if (expectedSecret) {
    const provided = req.headers.get('x-webhook-secret')
    if (provided !== expectedSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  let payload: PostmarkInbound
  try {
    payload = (await req.json()) as PostmarkInbound
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload?.From || !payload?.To) {
    return NextResponse.json({ ok: false, error: 'Missing From/To' }, { status: 400 })
  }

  const token = extractTripToken(payload.To)
  const trip = token ? await prisma.trip.findUnique({ where: { inboxToken: token } }) : null

  // Always persist the incoming email — even if we can't route it, we want a record.
  const incoming = await prisma.incomingEmail.create({
    data: {
      tripId: trip?.id ?? null,
      fromAddress: payload.From,
      toAddress: payload.To,
      subject: payload.Subject ?? '(no subject)',
      textBody: payload.TextBody ?? null,
      htmlBody: payload.HtmlBody ?? null,
    },
  })

  if (!trip) {
    return NextResponse.json({
      ok: true,
      warning: `No trip matched token "${token}". Email stored unrouted (id ${incoming.id}).`,
    })
  }

  // Parse + persist
  try {
    const validAttachments = (payload.Attachments ?? [])
      .filter((a) => a.Content && a.Content.length > 0)
    const inputAttachments = validAttachments.map((a) => ({
      filename: a.Name || 'attachment',
      mimeType: a.ContentType || 'application/octet-stream',
      contentBase64: a.Content,
    }))

    // Record what attachments arrived alongside the email so the user can see
    // on the email detail page whether their forward actually included them
    // (mobile mail apps often silently strip attachments on Forward).
    if (validAttachments.length > 0) {
      await prisma.emailAttachment.createMany({
        data: validAttachments.map((a) => ({
          emailId: incoming.id,
          filename: a.Name || 'attachment',
          mimeType: a.ContentType || 'application/octet-stream',
          storagePath: '', // content blob isn't persisted yet
          size: a.ContentLength || Math.floor((a.Content?.length ?? 0) * 0.75),
        })),
      })
    }

    const input: EmailInput = {
      from: payload.From,
      to: payload.To,
      subject: incoming.subject,
      text: incoming.textBody ?? '',
      html: incoming.htmlBody ?? undefined,
      attachments: inputAttachments,
    }
    const parsed = await parseEmail(input)
    const ingestSummary = await persistParserResult(trip, parsed, incoming.id)

    await prisma.incomingEmail.update({
      where: { id: incoming.id },
      data: { processed: true, parsedSummary: parsed.summary, parsedJson: JSON.stringify(parsed) },
    })

    return NextResponse.json({
      ok: true,
      tripSlug: trip.slug,
      mode: parsed.mode,
      summary: parsed.summary,
      ingest: ingestSummary,
    })
  } catch (err) {
    await prisma.incomingEmail.update({
      where: { id: incoming.id },
      data: { errorMsg: String(err), processed: true },
    })
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Voyage inbound email webhook',
    method: 'POST',
    expects: 'Postmark Inbound JSON payload',
    docs: 'https://postmarkapp.com/developer/user-guide/inbound/parse-an-email',
  })
}
