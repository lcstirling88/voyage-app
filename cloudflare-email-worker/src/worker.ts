/**
 * Cloudflare Email Worker — receives mail for inbox+{token}@your-domain and
 * forwards the raw RFC822 bytes to Voyage's webhook.
 *
 * The worker is intentionally minimal — no MIME parsing, no postal-mime, no
 * npm imports. Cloudflare's inline editor blocks imports, so the only safe
 * path is to have zero of them and let the Vercel-side webhook do the actual
 * MIME parsing (where the full npm ecosystem is available).
 *
 * Required env vars (Settings → Variables):
 *   VOYAGE_WEBHOOK_URL   e.g. https://voyage-christiansen.vercel.app/api/email/inbound
 *   WEBHOOK_SECRET       must match INBOUND_WEBHOOK_SECRET in Vercel
 */

interface Env {
  VOYAGE_WEBHOOK_URL: string
  WEBHOOK_SECRET: string
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const rawBytes = new Uint8Array(await new Response(message.raw).arrayBuffer())
    const rawBase64 = bytesToBase64(rawBytes)

    console.log('[voyage] forwarding email', {
      from: message.from,
      to: message.to,
      rawBytes: rawBytes.byteLength,
    })

    const res = await fetch(env.VOYAGE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': env.WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        From: message.from,
        To: message.to,
        RawMime: rawBase64,
        RawSize: rawBytes.byteLength,
      }),
    })

    if (!res.ok) {
      console.error('[voyage] webhook returned', res.status, await res.text())
    }
  },
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[])
  }
  return btoa(binary)
}

interface ForwardableEmailMessage {
  from: string
  to: string
  raw: ReadableStream
  setReject(reason: string): void
}
