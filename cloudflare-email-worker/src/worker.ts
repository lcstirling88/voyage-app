/**
 * Cloudflare Email Worker — receives mail for inbox+{token}@your-domain and
 * forwards it to Voyage's webhook in Postmark-compatible JSON.
 *
 * Deploy via the Cloudflare dashboard:
 *   Workers & Pages → Create → "Hello World" → paste this in → Deploy
 *   Then bind to Email Routing: Email → Email Routing → Routes →
 *     "Catch-all address" → Action: "Send to a Worker" → pick this worker.
 *
 * Required env vars in the Worker dashboard (Settings → Variables):
 *   VOYAGE_WEBHOOK_URL   e.g. https://voyage-christiansen.vercel.app/api/email/inbound
 *   WEBHOOK_SECRET       must match INBOUND_WEBHOOK_SECRET in Vercel
 */

import PostalMime from 'postal-mime'

interface Env {
  VOYAGE_WEBHOOK_URL: string
  WEBHOOK_SECRET: string
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    // Read the raw RFC822 stream and parse with postal-mime
    const rawBytes = new Uint8Array(await new Response(message.raw).arrayBuffer())
    const parsed = await PostalMime.parse(rawBytes)

    const payload = {
      From:       parsed.from?.address ?? message.from,
      FromName:   parsed.from?.name ?? '',
      To:         message.to,
      Subject:    parsed.subject ?? '(no subject)',
      TextBody:   parsed.text ?? '',
      HtmlBody:   parsed.html ?? '',
      Date:       parsed.date ?? new Date().toISOString(),
      Attachments: (parsed.attachments ?? []).map((a) => ({
        Name:          a.filename ?? 'attachment',
        ContentType:   a.mimeType ?? 'application/octet-stream',
        Content:       a.content ? bufferToBase64(a.content as ArrayBuffer) : '',
        ContentLength: a.content ? (a.content as ArrayBuffer).byteLength : 0,
      })),
    }

    const res = await fetch(env.VOYAGE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': env.WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      // Don't bounce — but log the failure for visibility
      console.error('[voyage] webhook returned', res.status, await res.text())
      // Optionally reject the email so the sender sees a bounce:
      // message.setReject(`Voyage couldn't process this email (HTTP ${res.status})`)
    }
  },
}

function bufferToBase64(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// Minimal type-shim so this file compiles without @cloudflare/workers-types installed
interface ForwardableEmailMessage {
  from: string
  to: string
  raw: ReadableStream
  setReject(reason: string): void
}
