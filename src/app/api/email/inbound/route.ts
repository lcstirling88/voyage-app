/**
 * Inbound email webhook.
 *
 * Accepts two payload shapes:
 *
 *   1. RawMime (preferred) — Cloudflare worker just base64-encodes the raw
 *      RFC822 email and sends { From, To, RawMime, RawSize }. We parse the
 *      MIME with postal-mime here on the server, which avoids needing to
 *      ship postal-mime into the Cloudflare worker's bundle (the dashboard
 *      editor doesn't allow npm or CDN imports). This is the only path that
 *      reliably preserves binary attachments.
 *
 *   2. Postmark-style — { From, To, Subject, TextBody, HtmlBody, Attachments[] }
 *      Kept for backward compat with existing/old worker deployments and for
 *      any future Postmark/Resend/SendGrid integration.
 *
 * Routing: emails are addressed inbox+{token}@your-domain.com. We pull the
 * token from the `+`-tag and look up the corresponding Trip.
 */

import { NextRequest, NextResponse } from 'next/server'
import PostalMime from 'postal-mime'
import { prisma } from '@/lib/db'
import { parseEmail, type EmailInput, type EmailAttachmentInput } from '@/lib/email-parser'
import { persistParserResult } from '@/lib/ingest'
import { uploadAttachment } from '@/lib/blob'

type PostmarkAttachment = {
  Name: string
  ContentType: string
  Content: string // base64
  ContentLength: number
}

type InboundPayload = {
  From?: string
  To?: string
  Subject?: string
  TextBody?: string
  HtmlBody?: string
  Date?: string
  Attachments?: PostmarkAttachment[]
  // RawMime path:
  RawMime?: string  // base64 of the raw RFC822 message
  RawSize?: number
}

type NormalizedEmail = {
  from: string
  to: string
  subject: string
  textBody: string
  htmlBody: string
  attachments: EmailAttachmentInput[]
  // What we report as "what the worker/sender claimed was there" — separate
  // from `attachments` so we can show 0-byte rows in the UI to distinguish
  // "decoder dropped it" from "no attachment in the email".
  reportedAttachments: { filename: string; mimeType: string; size: number }[]
}

function extractTripToken(to: string): string | null {
  const m = to.match(/^[^+]+\+([^@]+)@/i)
  return m?.[1] ?? null
}

/** Parse the raw RFC822 bytes with postal-mime and extract everything we need. */
async function normalizeFromRawMime(payload: InboundPayload): Promise<NormalizedEmail> {
  const rawBytes = Buffer.from(payload.RawMime ?? '', 'base64')
  const parsed = await PostalMime.parse(rawBytes)

  const reportedAttachments: NormalizedEmail['reportedAttachments'] = []
  const attachments: EmailAttachmentInput[] = []
  for (const a of parsed.attachments ?? []) {
    const filename = a.filename || 'attachment'
    const mimeType = a.mimeType || 'application/octet-stream'
    const content = a.content
    const bytes =
      content instanceof ArrayBuffer ? new Uint8Array(content)
      : ArrayBuffer.isView(content) ? new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
      : typeof content === 'string' ? Buffer.from(content, 'binary')
      : null
    const size = bytes ? bytes.byteLength : 0
    reportedAttachments.push({ filename, mimeType, size })
    if (bytes && bytes.byteLength > 0) {
      attachments.push({
        filename,
        mimeType,
        contentBase64: Buffer.from(bytes).toString('base64'),
      })
    }
  }

  return {
    from: parsed.from?.address || payload.From || 'unknown@unknown',
    to: payload.To || '',
    subject: parsed.subject || '(no subject)',
    textBody: parsed.text || '',
    htmlBody: parsed.html || '',
    attachments,
    reportedAttachments,
  }
}

/** Read attachments straight from a Postmark-style payload (legacy worker / Postmark integrations). */
function normalizeFromPostmark(payload: InboundPayload): NormalizedEmail {
  const reportedAttachments: NormalizedEmail['reportedAttachments'] = []
  const attachments: EmailAttachmentInput[] = []
  for (const a of payload.Attachments ?? []) {
    const filename = a.Name || 'attachment'
    const mimeType = a.ContentType || 'application/octet-stream'
    const size = a.ContentLength || Math.floor((a.Content?.length ?? 0) * 0.75)
    reportedAttachments.push({ filename, mimeType, size })
    if (a.Content && a.Content.length > 0) {
      attachments.push({ filename, mimeType, contentBase64: a.Content })
    }
  }
  return {
    from: payload.From || 'unknown@unknown',
    to: payload.To || '',
    subject: payload.Subject || '(no subject)',
    textBody: payload.TextBody || '',
    htmlBody: payload.HtmlBody || '',
    attachments,
    reportedAttachments,
  }
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.INBOUND_WEBHOOK_SECRET
  if (!expectedSecret) {
    // Fail closed: with no configured secret we cannot authenticate the sender,
    // so refuse the request rather than accept unauthenticated email injection.
    // (Prod sets this and the Cloudflare worker forwards the matching header.)
    console.error('[email-inbound] INBOUND_WEBHOOK_SECRET is not set — rejecting request')
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 503 })
  }
  const provided = req.headers.get('x-webhook-secret')
  if (provided !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let payload: InboundPayload
  try {
    payload = (await req.json()) as InboundPayload
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload?.From || !payload?.To) {
    return NextResponse.json({ ok: false, error: 'Missing From/To' }, { status: 400 })
  }

  // Log every inbound request before doing anything else, so even a complete
  // parser failure still leaves a trail in the Vercel runtime logs.
  console.log('[email-inbound] payload arrived', {
    from: payload.From,
    to: payload.To,
    format: payload.RawMime ? 'raw-mime' : 'postmark',
    rawSize: payload.RawSize ?? null,
    rawMimeChars: payload.RawMime?.length ?? 0,
    legacyAttachmentCount: payload.Attachments?.length ?? 0,
  })

  // Parse to whatever extent we can — but don't bail on failure. Worst case we
  // still want a row in IncomingEmail so the user sees the message showed up
  // and can fall back to manual paste / re-parse.
  let email: NormalizedEmail
  let parseError: string | null = null
  try {
    email = payload.RawMime
      ? await normalizeFromRawMime(payload)
      : normalizeFromPostmark(payload)
  } catch (err) {
    parseError = String(err)
    console.error('[email-inbound] MIME parse failed:', err)
    email = {
      from: payload.From || 'unknown@unknown',
      to: payload.To || '',
      subject: payload.Subject || '(MIME parse failed — see error below)',
      textBody: payload.TextBody || '',
      htmlBody: payload.HtmlBody || '',
      attachments: [],
      reportedAttachments: [],
    }
  }

  console.log('[email-inbound] normalized', {
    from: email.from,
    to: email.to,
    subject: email.subject.slice(0, 80),
    bodyChars: email.textBody.length + email.htmlBody.length,
    attachmentsReported: email.reportedAttachments.length,
    attachmentsWithContent: email.attachments.length,
    attachmentShapes: email.reportedAttachments.map((a) => `${a.filename}|${a.mimeType}|${a.size}B`),
    parseError,
  })

  const token = extractTripToken(email.to)
  const trip = token ? await prisma.trip.findUnique({ where: { inboxToken: token } }) : null

  // Always persist the incoming email — even if we can't parse or route it.
  const incoming = await prisma.incomingEmail.create({
    data: {
      tripId: trip?.id ?? null,
      fromAddress: email.from,
      toAddress: email.to,
      subject: email.subject,
      textBody: email.textBody || null,
      htmlBody: email.htmlBody || null,
      errorMsg: parseError,
      processed: parseError ? true : false, // mark parse-failures as terminal
    },
  })

  // Upload attachments that actually have bytes to Blob (only for routed
  // emails — no point storing files for spam we can't attribute to a trip).
  // Map filename → URL so the persisted rows below can carry the link.
  const urlByFilename = new Map<string, string>()
  if (trip && email.attachments.length > 0) {
    for (const a of email.attachments) {
      const url = await uploadAttachment({
        tripSlug: trip.slug,
        filename: a.filename,
        bytes: Buffer.from(a.contentBase64, 'base64'),
        mimeType: a.mimeType,
      })
      if (url) urlByFilename.set(a.filename, url)
    }
  }

  // Persist all reported attachments (including 0-byte ones) so the email
  // detail page shows what the worker saw — useful for diagnosing missing
  // content vs. no attachment at all. storagePath holds the Blob URL when
  // we managed to store the bytes.
  if (email.reportedAttachments.length > 0) {
    await prisma.emailAttachment.createMany({
      data: email.reportedAttachments.map((a) => ({
        emailId: incoming.id,
        filename: a.filename,
        mimeType: a.mimeType,
        storagePath: urlByFilename.get(a.filename) ?? '',
        size: a.size,
      })),
    })
  }

  if (!trip) {
    return NextResponse.json({
      ok: true,
      warning: `No trip matched token "${token}". Email stored unrouted (id ${incoming.id}).`,
    })
  }

  // If MIME parsing already blew up upstream, skip running the LLM parser
  // (the body and attachments will both be empty) — the email is at least
  // recorded with the error visible on the detail page.
  if (parseError) {
    return NextResponse.json({
      ok: true,
      warning: `Stored as id ${incoming.id} but MIME parse failed: ${parseError}`,
    })
  }

  try {
    const input: EmailInput = {
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.textBody,
      html: email.htmlBody || undefined,
      attachments: email.attachments,
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
    expects: 'RawMime payload (preferred) or Postmark-style JSON',
  })
}
