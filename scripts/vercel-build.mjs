// Vercel build wrapper: runs `prisma migrate deploy` with retries before
// invoking `next build`. The Neon serverless Postgres adapter sometimes fails
// to connect on a cold-start, which has been silently failing Vercel deploys
// every other push. We try up to 3 times with a short backoff before giving up.
//
// Binaries are resolved from node_modules/.bin so we don't depend on npx being
// in PATH (works the same on local Windows + Vercel Linux).

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BIN_SUFFIX = process.platform === 'win32' ? '.cmd' : ''
function binPath(name) {
  return path.join('node_modules', '.bin', `${name}${BIN_SUFFIX}`)
}

// Ensure the spawned process can find `node` — when this script is invoked
// directly by Node (not via npm), PATH may not include the Node bin dir, and
// the .cmd shims in node_modules/.bin internally `call node`.
const nodeBinDir = path.dirname(fileURLToPath(import.meta.url).startsWith('/') ? process.execPath : process.execPath)
const sep = process.platform === 'win32' ? ';' : ':'
const ENV = { ...process.env, PATH: `${nodeBinDir}${sep}${process.env.PATH ?? ''}` }

function run(bin, args) {
  return new Promise((resolve, reject) => {
    // shell: true is required on Windows to spawn .cmd / .bat shims from
    // node_modules/.bin. On Linux it's a no-op since the bin files are
    // executable scripts.
    const child = spawn(bin, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: ENV,
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${bin} ${args.join(' ')} exited ${code}`))
    })
    child.on('error', reject)
  })
}

async function withRetry(label, fn, { attempts = 3, backoffMs = 6000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await fn()
      if (i > 1) console.log(`[vercel-build] ${label} succeeded on attempt ${i}`)
      return
    } catch (err) {
      console.error(`[vercel-build] ${label} attempt ${i}/${attempts} failed: ${err.message}`)
      if (i === attempts) throw err
      const wait = backoffMs * i
      console.log(`[vercel-build] waiting ${wait}ms before retry...`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

async function main() {
  await withRetry('prisma migrate deploy', () => run(binPath('prisma'), ['migrate', 'deploy']))
  // next build is deterministic — no retry, a failure here is real.
  await run(binPath('next'), ['build'])
}

main().catch((err) => {
  console.error('[vercel-build] fatal:', err.message)
  process.exit(1)
})
