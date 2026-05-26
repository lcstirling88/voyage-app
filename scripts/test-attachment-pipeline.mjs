// Local end-to-end test for the attachment pipeline.
//
// Simulates the full flow:
//   1. Synthesize a real RFC822 multipart email with a PDF attachment inline.
//   2. Encode the raw bytes as base64 (what the Cloudflare worker would do).
//   3. Decode + parse with postal-mime (what the Vercel webhook does).
//   4. Run the exact same attachment-encoding logic as normalizeFromRawMime().
//   5. Assert the round-tripped bytes match the original PDF byte-for-byte.
//
// If this passes, the RawMime worker → Vercel webhook flow works end-to-end
// for attachments and we can ship the worker with confidence. If it fails,
// the test output tells us exactly which step is dropping the bytes.

import PostalMime from 'postal-mime'

// A tiny "PDF" — just enough bytes that no encoder can plausibly handle
// it as plain text. Contains the PDF magic header, some control bytes, and
// some non-ASCII payload to catch latin1/utf-8 confusion.
const testPdfBytes = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, // %PDF-1.4\n
  0x00, 0x01, 0x02, 0x03, 0xFD, 0xFE, 0xFF,             // binary control bytes
  0x48, 0x65, 0x6C, 0x6C, 0x6F,                          // Hello
  0xE2, 0x9C, 0x93,                                      // ✓ in UTF-8
  0x00, 0xFF, 0x80, 0x7F,                                // boundary bytes
])

const expectedFilename = 'test-ticket.pdf'
const expectedMime = 'application/pdf'

// Build a real RFC822 multipart message. RFC 2046 requires:
//   - CRLF line endings throughout
//   - A blank line (i.e. "\r\n\r\n") between the message headers and the body
//   - Boundary marker is exactly "--" + boundary-value, no extra dashes from us
const boundary = 'voyage-test-9k3jx2bzq8'

const eml = [
  'From: "Sender" <sender@example.com>',
  'To: inbox+abc123@voyage-christiansen.com',
  'Subject: Test email with PDF attachment',
  'MIME-Version: 1.0',
  `Content-Type: multipart/mixed; boundary="${boundary}"`,
  '',                                                       // <-- blank line separating message headers from body
  `--${boundary}`,
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: 7bit',
  '',                                                       // <-- blank line separating part headers from part body
  'This is the email body. Booking attached.',
  '',                                                       // <-- trailing blank before next boundary
  `--${boundary}`,
  `Content-Type: ${expectedMime}; name="${expectedFilename}"`,
  `Content-Disposition: attachment; filename="${expectedFilename}"`,
  'Content-Transfer-Encoding: base64',
  '',                                                       // <-- blank line separating part headers from part body
  Buffer.from(testPdfBytes).toString('base64'),
  '',                                                       // <-- trailing blank before closing boundary
  `--${boundary}--`,
  '',
].join('\r\n')

const rawBytes = Buffer.from(eml, 'utf-8')

console.log(`[step 1] Synthesized email: ${rawBytes.byteLength} bytes`)

// === Step 2: worker side — base64 the raw bytes ===
const rawBase64 = rawBytes.toString('base64')
console.log(`[step 2] Worker base64 length: ${rawBase64.length} chars`)

// === Step 3: webhook side — decode + postal-mime parse ===
const decoded = Buffer.from(rawBase64, 'base64')
console.log(`[step 3] Decoded ${decoded.byteLength} bytes (match: ${decoded.byteLength === rawBytes.byteLength})`)

const parsed = await PostalMime.parse(decoded)

console.log(`[step 4] Parsed email:`)
console.log(`   subject:     ${parsed.subject}`)
console.log(`   from:        ${parsed.from?.address ?? '(none)'}`)
console.log(`   text body:   ${parsed.text?.slice(0, 60)}...`)
console.log(`   attachments: ${parsed.attachments?.length ?? 0}`)

if (!parsed.attachments || parsed.attachments.length === 0) {
  console.error('FAIL: postal-mime returned zero attachments. The MIME structure or postal-mime itself is broken.')
  process.exit(1)
}

// === Step 5: encode attachment exactly as normalizeFromRawMime() does ===
const a = parsed.attachments[0]
console.log(`[step 5] First attachment:`)
console.log(`   filename:    ${a.filename}`)
console.log(`   mimeType:    ${a.mimeType}`)
console.log(`   content typeof: ${typeof a.content}`)
console.log(`   content ArrayBuffer? ${a.content instanceof ArrayBuffer}`)
console.log(`   content TypedArray view? ${ArrayBuffer.isView(a.content)}`)
console.log(`   content ctor: ${a.content?.constructor?.name ?? 'n/a'}`)

const content = a.content
let bytes = null
if (content instanceof ArrayBuffer) {
  bytes = new Uint8Array(content)
} else if (ArrayBuffer.isView(content)) {
  bytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
} else if (typeof content === 'string') {
  bytes = Buffer.from(content, 'binary')
}

if (!bytes) {
  console.error('FAIL: could not decode attachment content into bytes.')
  process.exit(1)
}

console.log(`[step 6] Encoded bytes: ${bytes.byteLength} (expected ${testPdfBytes.byteLength})`)

if (bytes.byteLength !== testPdfBytes.byteLength) {
  console.error(`FAIL: byte length mismatch. Got ${bytes.byteLength}, expected ${testPdfBytes.byteLength}.`)
  process.exit(1)
}

let matchCount = 0
for (let i = 0; i < testPdfBytes.byteLength; i++) {
  if (bytes[i] === testPdfBytes[i]) matchCount++
}

if (matchCount !== testPdfBytes.byteLength) {
  console.error(`FAIL: only ${matchCount}/${testPdfBytes.byteLength} bytes match.`)
  for (let i = 0; i < Math.min(testPdfBytes.byteLength, 32); i++) {
    if (bytes[i] !== testPdfBytes[i]) {
      console.error(`   byte ${i}: got 0x${bytes[i].toString(16)}, expected 0x${testPdfBytes[i].toString(16)}`)
    }
  }
  process.exit(1)
}

// === Step 7: re-base64-encode and confirm round-trip ===
const finalBase64 = Buffer.from(bytes).toString('base64')
const expectedBase64 = Buffer.from(testPdfBytes).toString('base64')
if (finalBase64 !== expectedBase64) {
  console.error('FAIL: re-encoded base64 does not match expected.')
  console.error(`   got:      ${finalBase64}`)
  console.error(`   expected: ${expectedBase64}`)
  process.exit(1)
}

console.log(`[step 7] Final base64: ${finalBase64} (match: true)`)
console.log('')
console.log('PASS: end-to-end attachment pipeline works.')
console.log(`Original PDF: ${testPdfBytes.byteLength} bytes`)
console.log(`Round-tripped: ${bytes.byteLength} bytes, byte-for-byte identical`)
