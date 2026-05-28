/**
 * Vercel Blob storage helper for booking attachments (PDFs, images, .ics).
 *
 * Email confirmations carry the actual booking PDFs. Previously those bytes
 * were parsed by Claude then discarded; now we persist them to Vercel Blob
 * so users can open the real insurance/hotel/flight document later.
 *
 * Degrades gracefully: if BLOB_READ_WRITE_TOKEN isn't configured yet, every
 * upload returns null and callers fall back to storing no file (the app
 * behaves exactly as it did before Blob was wired up). That lets this ship
 * before the Vercel Blob store is enabled in the dashboard.
 */

/** Strip a filename down to something safe for a blob key path. */
function safeName(filename: string): string {
  const cleaned = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return cleaned || 'file'
}

/** True once a Blob store is connected (token present in the environment). */
export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/**
 * Upload one attachment to Blob and return its public URL, or null if Blob
 * isn't configured or the upload failed. Never throws — attachment storage
 * is best-effort and must not break email ingestion.
 */
export async function uploadAttachment(opts: {
  tripSlug: string
  filename: string
  bytes: Buffer | Uint8Array
  mimeType: string
}): Promise<string | null> {
  if (!blobConfigured()) return null
  try {
    // Lazy import so the module isn't pulled in (or its env read) unless used.
    const { put } = await import('@vercel/blob')
    const key = `trips/${opts.tripSlug}/${Date.now()}-${safeName(opts.filename)}`
    const result = await put(key, Buffer.from(opts.bytes), {
      access: 'public',
      contentType: opts.mimeType || 'application/octet-stream',
      addRandomSuffix: true,
    })
    return result.url
  } catch (err) {
    console.error('[blob] upload failed for', opts.filename, err)
    return null
  }
}

/** Whether a stored attachment can be previewed inline (vs just downloaded). */
export function isViewable(mimeType: string): boolean {
  const m = (mimeType || '').toLowerCase()
  return m.includes('pdf') || m.startsWith('image/')
}
