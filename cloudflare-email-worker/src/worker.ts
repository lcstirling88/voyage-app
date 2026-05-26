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

    // Defensive attachment encoding. postal-mime can return `content` as an
    // ArrayBuffer, a Uint8Array (sometimes — depending on encoding), or a
    // base64-string-already, depending on the source email's MIME structure.
    // The original implementation assumed ArrayBuffer unconditionally and
    // silently produced a 0-byte base64 string for any other shape — which is
    // exactly the symptom we saw with a Gmail-attached Qantas e-ticket PDF.
    const attachments = (parsed.attachments ?? []).map((a) => {
      const encoded = encodeAttachmentContent(a.content)
      return {
        Name:          a.filename ?? 'attachment',
        ContentType:   a.mimeType ?? 'application/octet-stream',
        Content:       encoded.base64,
        ContentLength: encoded.bytes,
        // Surface what shape postal-mime gave us so we can debug from the Vercel
        // side if content goes missing again.
        _ContentRepr:  encoded.repr,
      }
    })

    const payload = {
      From:       parsed.from?.address ?? message.from,
      FromName:   parsed.from?.name ?? '',
      To:         message.to,
      Subject:    parsed.subject ?? '(no subject)',
      TextBody:   parsed.text ?? '',
      HtmlBody:   parsed.html ?? '',
      Date:       parsed.date ?? new Date().toISOString(),
      Attachments: attachments,
      // Diagnostic — logged by the webhook on receipt. Lets us tell apart
      // "Gmail/iOS Mail stripped the attachment" vs. "postal-mime saw a part
      // but couldn't decode it" vs. "Cloudflare delivered nothing".
      _Diagnostic: {
        rawBytes: rawBytes.byteLength,
        attachmentCount: parsed.attachments?.length ?? 0,
        decodedCount: attachments.filter((a) => a.ContentLength > 0).length,
        attachmentShapes: attachments.map((a) => `${a.Name}|${a.ContentType}|${a.ContentLength}B|${a._ContentRepr}`),
      },
    }

    // Log to Cloudflare worker logs so this is visible in the CF dashboard too.
    console.log('[voyage] forwarding email', {
      from: payload.From,
      to: payload.To,
      subject: payload.Subject?.slice(0, 80),
      diagnostic: payload._Diagnostic,
    })

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

/**
 * Convert whatever shape postal-mime hands us in `attachment.content` into a
 * base64 string. Handles ArrayBuffer, Uint8Array, plain strings (binary or
 * already-base64), and falls back to "" without throwing on unknown shapes —
 * we'd rather report a 0-byte attachment than crash the whole worker.
 */
function encodeAttachmentContent(content: unknown): { base64: string; bytes: number; repr: string } {
  if (!content) return { base64: '', bytes: 0, repr: 'null' }

  // ArrayBuffer / SharedArrayBuffer
  if (content instanceof ArrayBuffer) {
    return { base64: bytesToBase64(new Uint8Array(content)), bytes: content.byteLength, repr: 'ArrayBuffer' }
  }

  // Uint8Array or other typed array views
  if (ArrayBuffer.isView(content)) {
    const view = content as ArrayBufferView
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    return { base64: bytesToBase64(bytes), bytes: view.byteLength, repr: (content as object).constructor.name }
  }

  // String — could be:
  //   (a) already base64 (postal-mime sometimes returns base64 text for
  //       base64-encoded MIME parts)
  //   (b) a binary string (one char per byte, e.g. "latin1")
  //   (c) a UTF-8 text body
  if (typeof content === 'string') {
    // Heuristic: if every char is in the base64 alphabet (plus =) and length
    // is a multiple of 4, treat it as base64 already. Otherwise treat it as a
    // raw binary string.
    const looksBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(content) && content.length % 4 === 0
    if (looksBase64) {
      // Compute decoded byte length without actually decoding to save memory
      const padding = content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0
      const bytes = (content.length / 4) * 3 - padding
      return { base64: content, bytes, repr: 'string(base64)' }
    }
    // Treat as binary string
    try {
      const arr = new Uint8Array(content.length)
      for (let i = 0; i < content.length; i++) arr[i] = content.charCodeAt(i) & 0xff
      return { base64: bytesToBase64(arr), bytes: arr.byteLength, repr: 'string(binary)' }
    } catch {
      return { base64: '', bytes: 0, repr: 'string(undecodable)' }
    }
  }

  return { base64: '', bytes: 0, repr: typeof content }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  // Process in chunks to avoid stack overflow on very large attachments
  const chunk = 0x8000
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[])
  }
  return btoa(binary)
}

// Minimal type-shim so this file compiles without @cloudflare/workers-types installed
interface ForwardableEmailMessage {
  from: string
  to: string
  raw: ReadableStream
  setReject(reason: string): void
}
