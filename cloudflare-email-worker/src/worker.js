// @ts-nocheck
/**
 * Cloudflare Email Worker — receives mail for inbox+{token}@voyage-christiansen.com
 * and forwards the raw RFC822 bytes to Voyage's webhook on Vercel.
 *
 * The worker is intentionally minimal — no MIME parsing, no postal-mime, no
 * imports. Cloudflare's inline dashboard editor blocks any import (npm OR
 * CDN URL), so this stays a pure pass-through. The Vercel-side webhook does
 * the actual MIME parsing where the full npm ecosystem is available.
 *
 * Required env vars (Settings → Variables and Secrets):
 *   VOYAGE_WEBHOOK_URL  e.g. https://voyage-christiansen.vercel.app/api/email/inbound
 *   WEBHOOK_SECRET      must match INBOUND_WEBHOOK_SECRET in Vercel
 *
 * Verified end-to-end with scripts/test-attachment-pipeline.mjs — synthesises
 * a real RFC822 multipart message with a PDF, base64-encodes it the same way
 * this worker does, and confirms the Vercel webhook round-trips the PDF
 * byte-for-byte through postal-mime.
 */

export default {
  async email(message, env) {
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
      const text = await res.text()
      console.error('[voyage] webhook returned non-ok', res.status, text.slice(0, 500))
    }
  },
}

// Chunked base64 encoder. String.fromCharCode.apply has an argument-count
// ceiling around ~125000 on V8; we encode in 32K-byte chunks to stay well
// under it for emails up to ~25MB.
function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, slice)
  }
  return btoa(binary)
}
