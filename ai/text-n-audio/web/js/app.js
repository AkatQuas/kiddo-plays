import { createVoiceToText } from './voice-to-text.js'
import { createPCMPlayer } from './pcm-player.js'

const outputEl = document.getElementById('output')
const statusEl = document.getElementById('status')
const micBtn = document.getElementById('mic-btn')
const visualizerSlot = document.getElementById('visualizer-slot')
const healthEl = document.getElementById('health')
const ttsBtn = document.getElementById('tts-btn')
const ttsIcon = document.getElementById('tts-icon')
const ttsLabel = document.getElementById('tts-label')
const ttsStatusEl = document.getElementById('tts-status')

const pendingChunks = []
let chunkSeq = 0

function setStatus(text, tone = 'muted') {
  statusEl.textContent = text
  statusEl.dataset.tone = tone
}

function setTtsStatus(text, tone = 'muted') {
  ttsStatusEl.textContent = text
  ttsStatusEl.dataset.tone = tone
}

async function transcribeBlob(blob) {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wave' },
    body: blob,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.error || res.statusText)
  }
  const json = await res.json()
  return (json.data?.text || '').trim()
}

function appendText(text) {
  if (!text) return
  outputEl.textContent += text
  outputEl.scrollTop = outputEl.scrollHeight
}

function queueTranscription(blob) {
  const id = ++chunkSeq
  const task = transcribeBlob(blob)
    .then((text) => {
      appendText(text)
      setStatus(`识别中… (#${id} ✓)`, 'active')
    })
    .catch((err) => {
      console.error(err)
      setStatus(`识别失败: ${err.message}`, 'error')
    })
  pendingChunks.push(task)
  return task
}

const voice = createVoiceToText({
  sampleRate: 24000,
  numOfChannels: 1,
  emitStreamChunks: true,
  visualizerConfig: { width: 48, height: 24, barColor: '#7c3aed' },
  onTranscription(blob) {
    setStatus('流式识别中…', 'active')
    queueTranscription(blob)
  },
  async onTranscriptionStop(blob) {
    if (blob) queueTranscription(blob)
    await Promise.all([...pendingChunks])
    pendingChunks.length = 0
    setStatus('已停止', 'muted')
    micBtn.textContent = '🎤'
    micBtn.classList.remove('recording')
    visualizerSlot.classList.add('hidden')
  },
  onError(err) {
    setStatus(
      err.name === 'NotAllowedError'
        ? '请允许麦克风权限'
        : err.name === 'NotFoundError'
          ? '未检测到麦克风'
          : err.message || '麦克风错误',
      'error',
    )
    micBtn.textContent = '🎤'
    micBtn.classList.remove('recording')
    visualizerSlot.classList.add('hidden')
  },
})

visualizerSlot.appendChild(voice.canvas)

micBtn.addEventListener('click', () => {
  if (voice.permissionReading || voice.stopping) return

  if (voice.isRecording) {
    voice.stop()
    micBtn.textContent = '⏳'
    setStatus('收尾识别…', 'active')
    return
  }

  pcmPlayer.stop()
  micBtn.textContent = '⏹️'
  micBtn.classList.add('recording')
  visualizerSlot.classList.remove('hidden')
  setStatus('录音中 — 每 ~2s 推送一段识别', 'active')
  voice.start()
})

document.getElementById('clear-btn').addEventListener('click', () => {
  outputEl.textContent = ''
  setStatus('已清空', 'muted')
})

// --- TTS (usePCMPlayer port) ---
const pcmPlayer = createPCMPlayer({ url: '/api/tts/stream' })

function refreshTtsUi() {
  const { loading, isPlaying } = pcmPlayer
  if (loading) {
    ttsIcon.textContent = '⏳'
    ttsLabel.textContent = '加载中…'
    ttsBtn.classList.remove('playing')
    setTtsStatus('请求 TTS 流…', 'wait')
  } else if (isPlaying) {
    ttsIcon.textContent = '⏹️'
    ttsLabel.textContent = '停止'
    ttsBtn.classList.add('playing')
    setTtsStatus('播放中（SSE PCM 流）', 'active')
  } else {
    ttsIcon.textContent = '▶️'
    ttsLabel.textContent = '朗读文本'
    ttsBtn.classList.remove('playing')
    setTtsStatus('SSE 流式 PCM 播放', 'muted')
  }
}

pcmPlayer.onStateChange(refreshTtsUi)

ttsBtn.addEventListener('click', () => {
  if (pcmPlayer.loading || pcmPlayer.isPlaying) {
    pcmPlayer.stop()
    refreshTtsUi()
    return
  }

  const text = outputEl.textContent.trim()
  if (!text) {
    setTtsStatus('请先输入或识别一些文字', 'error')
    return
  }

  if (voice.isRecording) {
    voice.stop()
  }

  pcmPlayer.play({ text, spk_id: '中文女' }).catch((err) => {
    if (err.name !== 'AbortError') {
      setTtsStatus(`TTS 失败: ${err.message}`, 'error')
    }
  })
})

async function checkHealth() {
  try {
    const res = await fetch('/api/health')
    const data = await res.json()
    const parts = []
    if (data.asr?.loaded) parts.push(`ASR ✓ (${data.asr.model})`)
    else if (data.asr) parts.push('ASR ⏳')
    if (data.tts?.loaded) parts.push(`TTS ✓ (${data.tts.sample_rate}Hz)`)
    else if (data.tts) parts.push('TTS ⏳')
    if (parts.length) {
      healthEl.textContent = parts.join(' · ')
      healthEl.dataset.tone = data.asr?.loaded && data.tts?.loaded ? 'ok' : 'wait'
    } else {
      healthEl.textContent = '❌ 后端不可用'
      healthEl.dataset.tone = 'error'
    }
  } catch {
    healthEl.textContent = '❌ 无法连接后端'
    healthEl.dataset.tone = 'error'
  }
}

checkHealth()
setInterval(checkHealth, 15000)
