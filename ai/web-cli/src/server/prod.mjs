// Production server for Web CLI.
//
// Serves the built TanStack Start app and attaches Socket.io
// to the same HTTP server, mirroring the Vite plugin in dev mode.
//
// Usage:
//   node src/server/prod.mjs
//
// Environment:
//   PORT  — listen port (default: 3000)
//   HOST  — listen host (default: '0.0.0.0')

import http from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const CLIENT_DIR = resolve(ROOT, 'dist/client')
const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || '0.0.0.0'

const MIME = {
  js: 'application/javascript',
  css: 'text/css',
  png: 'image/png',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  json: 'application/json',
  txt: 'text/plain',
  html: 'text/html',
  xml: 'application/xml',
  webp: 'image/webp',
}

async function main() {
  // 1. Load the built TanStack Start SSR handler
  const serverEntry = await import(resolve(ROOT, 'dist/server/server.js'))
  const fetch = serverEntry.default?.fetch || serverEntry.fetch
  if (!fetch) {
    console.error('[Prod] No fetch handler in dist/server/server.js')
    process.exit(1)
  }

  // 2. Attach Socket.io to the HTTP server (same pattern as dev mode)
  const bootstrap = await import(resolve(__dirname, 'bootstrap.mjs'))

  // 3. Create the HTTP server
  const server = http.createServer()

  server.on('request', async (req, res) => {
    try {
      const url = req.url || '/'

      // --- Static file serving ---
      // For asset requests, serve directly from dist/client/
      if (url.startsWith('/assets/') || url === '/favicon.ico' || url === '/robots.txt' || url === '/manifest.json' || url.startsWith('/logo')) {
        const filePath = resolve(CLIENT_DIR, url.slice(1))
        // Security: ensure the resolved path is within CLIENT_DIR
        if (!filePath.startsWith(CLIENT_DIR)) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }
        if (!existsSync(filePath)) {
          res.statusCode = 404
          res.end('Not Found')
          return
        }
        const ext = filePath.split('.').pop() || ''
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        createReadStream(filePath).pipe(res)
        return
      }

      // --- HTML / API routes: delegate to TanStack Start SSR handler ---
      const protocol = req.socket.encrypted ? 'https' : 'http'
      const host = req.headers.host || `${HOST}:${PORT}`
      const requestUrl = new URL(url, `${protocol}://${host}`)

      const headers = new Headers()
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        headers.set(req.rawHeaders[i], req.rawHeaders[i + 1])
      }

      let body = undefined
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = await new Promise((resolve) => {
          const chunks = []
          req.on('data', (c) => chunks.push(c))
          req.on('end', () => resolve(Buffer.concat(chunks)))
        })
      }

      const webReq = new Request(requestUrl, {
        method: req.method,
        headers,
        body: body?.length ? body : undefined,
        duplex: 'half',
      })

      const webRes = await fetch(webReq)

      res.statusCode = webRes.status
      webRes.headers.forEach((v, k) => res.setHeader(k, v))

      if (webRes.body) {
        const reader = webRes.body.getReader()
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(value)
          }
          res.end()
        }
        pump().catch(() => res.end())
      } else {
        res.end()
      }
    } catch (err) {
      console.error('[Prod] Error handling request:', req.url, err.message)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    }
  })

  // 4. Attach Socket.io
  bootstrap.attachToHttpServer(server)

  // 5. Start
  server.listen(PORT, HOST, () => {
    console.log(`[Prod] Web CLI running at http://${HOST}:${PORT}`)
    console.log(`[Prod] Terminal at http://${HOST}:${PORT}/terminal`)
  })
}

main().catch((err) => {
  console.error('[Prod] Fatal:', err)
  process.exit(1)
})