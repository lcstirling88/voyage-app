// Verify the worker's chunked bytesToBase64 produces identical output to
// Buffer.from().toString('base64'). The worker can't use Buffer (no Node API
// in Cloudflare Workers), it has to use btoa + String.fromCharCode.

// Shim btoa for Node (Node 16+ has it globally but be safe)
if (typeof btoa === 'undefined') {
  globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64')
}

// Mirror the exact function from worker.js
function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, slice)
  }
  return btoa(binary)
}

// Test cases at sizes that exercise the chunking boundary
const testSizes = [0, 1, 100, 1024, 0x7FFF, 0x8000, 0x8001, 0x10000, 0x20000, 500_000]

let allPass = true
for (const size of testSizes) {
  // Generate deterministic bytes including high-byte values
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i++) bytes[i] = (i * 37) & 0xFF

  const workerOutput = bytesToBase64(bytes)
  const nodeOutput = Buffer.from(bytes).toString('base64')

  const match = workerOutput === nodeOutput
  console.log(`  size=${size.toString().padStart(7)} bytes — worker=${workerOutput.length} chars, node=${nodeOutput.length} chars, match=${match}`)
  if (!match) {
    allPass = false
    // Show where they diverge
    for (let i = 0; i < Math.min(workerOutput.length, nodeOutput.length); i++) {
      if (workerOutput[i] !== nodeOutput[i]) {
        console.error(`    diverge at char ${i}: worker='${workerOutput.slice(i, i + 20)}', node='${nodeOutput.slice(i, i + 20)}'`)
        break
      }
    }
  }
}

if (allPass) {
  console.log('')
  console.log('PASS: worker chunked encoder produces identical output to Buffer.toString(base64) across all sizes.')
  process.exit(0)
} else {
  console.error('FAIL: worker encoder diverges from Buffer encoding.')
  process.exit(1)
}
