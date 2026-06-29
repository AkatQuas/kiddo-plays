import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Readable } from 'stream'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3000)
const ASR_SERVICE_URL = process.env.ASR_SERVICE_URL || 'http://localhost:8001'
const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || 'http://localhost:8002'

const publicDir = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../web')

const app = express()

app.get('/api/health', async (_req, res) => {
  const result = { ok: true, asr: null, tts: null }
  try {
    const [asrRes, ttsRes] = await Promise.allSettled([
      fetch(`${ASR_SERVICE_URL}/health`),
      fetch(`${TTS_SERVICE_URL}/health`),
    ])
    if (asrRes.status === 'fulfilled' && asrRes.value.ok) {
      result.asr = await asrRes.value.json()
    }
    if (ttsRes.status === 'fulfilled' && ttsRes.value.ok) {
      result.tts = await ttsRes.value.json()
    }
    if (!result.asr && !result.tts) {
      return res.status(503).json({ ok: false, error: 'no upstream healthy' })
    }
    res.json(result)
  } catch (err) {
    res.status(503).json({ ok: false, error: String(err) })
  }
})

app.post('/api/transcribe', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '8mb' }), async (req, res) => {
  try {
    const upstream = await fetch(`${ASR_SERVICE_URL}/transcribe/raw?language=zh`, {
      method: 'POST',
      headers: { 'Content-Type': req.headers['content-type'] || 'audio/wav' },
      body: req.body,
    })
    const data = await upstream.json()
    if (!upstream.ok) {
      return res.status(upstream.status).json(data)
    }
    res.json({ data: { text: data.text || '' }, model: data.model })
  } catch (err) {
    res.status(502).json({ error: 'asr upstream failed', detail: String(err) })
  }
})

app.post('/api/tts/stream', express.json({ limit: '64kb' }), async (req, res) => {
  try {
    const upstream = await fetch(`${TTS_SERVICE_URL}/tts/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    if (!upstream.ok) {
      const err = await upstream.text()
      return res.status(upstream.status).send(err)
    }
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res)
    } else {
      res.end()
    }
  } catch (err) {
    res.status(502).json({ error: 'tts upstream failed', detail: String(err) })
  }
})

app.use(express.static(publicDir))

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`text-n-audio web listening on http://0.0.0.0:${PORT}`)
  console.log(`ASR upstream: ${ASR_SERVICE_URL}`)
  console.log(`TTS upstream: ${TTS_SERVICE_URL}`)
})
