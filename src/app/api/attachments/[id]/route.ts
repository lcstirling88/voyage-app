import { NextRequest } from 'next/server'
import { get } from '@vercel/blob'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

// Sensitive files (passports, e-tickets, vouchers) live in a PRIVATE Blob
// store with no public URL. This route streams the bytes back, but only after
// confirming the caller is a member of the trip the attachment belongs to.
// force-dynamic so the auth + membership check runs on every request and is
// never statically cached.
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/attachments/[id]'>) {
  const { id } = await ctx.params

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const att = await prisma.emailAttachment.findUnique({
    where: { id },
    select: {
      filename: true,
      mimeType: true,
      storagePath: true,
      email: { select: { trip: { select: { id: true } } } },
    },
  })
  // No row, or row predates Blob storage (empty storagePath) → nothing to serve.
  if (!att || !att.storagePath) return new Response('Not found', { status: 404 })

  const tripId = att.email?.trip?.id
  if (!tripId) return new Response('Not found', { status: 404 })

  // The access gate: caller must be a member of this attachment's trip.
  const membership = await prisma.membership.findFirst({
    where: { user: { id: userId }, trip: { id: tripId } },
    select: { id: true },
  })
  if (!membership) return new Response('Forbidden', { status: 403 })

  // Private blobs have no public URL — read them server-side with the token.
  let result
  try {
    result = await get(att.storagePath, { access: 'private' })
  } catch (err) {
    console.error('[attachments] blob get failed', id, err)
    return new Response('File unavailable', { status: 502 })
  }
  if (!result || result.statusCode !== 200) return new Response('Not found', { status: 404 })

  const contentType = att.mimeType || result.blob.contentType || 'application/octet-stream'
  // Strip CR/LF/quotes so the filename can't break out of the header.
  const safeName = (att.filename || 'attachment').replace(/[\r\n"]/g, '_')
  // PDFs and images preview in-browser; anything else downloads.
  const disposition = /pdf|^image\//i.test(contentType) ? 'inline' : 'attachment'

  return new Response(result.stream, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
