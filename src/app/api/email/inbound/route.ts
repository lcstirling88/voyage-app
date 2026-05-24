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
    const input: EmailInput = {
      from: payload.From,
      to: payload.To,
      subject: incoming.subject,
      text: incoming.textBody ?? '',
      html: incoming.htmlBody ?? undefined,
    }
    const parsed = await parseEmail(input)

    for (const b of parsed.bookings) {
      await prisma.booking.create({
        data: {
          tripId: trip.id,
          type: b.type,
          title: b.title,
          vendor: b.vendor,
          startAt: new Date(b.startAt),
          endAt: b.endAt ? new Date(b.endAt) : undefined,
          location: b.location,
          address: b.address,
          confirmationCode: b.confirmationCode,
          notes: b.notes,
          cost: b.cost,
          currency: b.currency ?? trip.homeCurrency,
          paid: b.paid ?? false,
          metadata: b.metadata ? JSON.stringify(b.metadata) : undefined,
          sourceEmailId: incoming.id,
        },
      })
    }

    for (const d of parsed.documents) {
      await prisma.document.create({
        data: { tripId: trip.id, category: d.category, title: d.title, notes: d.notes, sourceEmailId: incoming.id },
      })
    }

    for (const p of parsed.payments) {
      await prisma.payment.create({
        data: {
          tripId: trip.id,
          description: p.description,
          amount: p.amount,
          currency: p.currency,
          dueDate: new Date(p.dueDate),
          autoPay: p.autoPay ?? false,
          paymentMethod: p.paymentMethod,
        },
      })
    }

    await prisma.incomingEmail.update({
      where: { id: incoming.id },
      data: { processed: true, parsedSummary: parsed.summary, parsedJson: JSON.stringify(parsed) },
    })

    return NextResponse.json({
      ok: true,
      tripSlug: trip.slug,
      mode: parsed.mode,
      summary: parsed.summary,
      counts: {
        bookings: parsed.bookings.length,
        documents: parsed.documents.length,
        payments: parsed.payments.length,
      },
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
