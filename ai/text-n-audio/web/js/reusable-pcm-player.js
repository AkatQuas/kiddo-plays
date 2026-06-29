import { base64ToPCM } from './base64-to-pcm.js'

const ttsProcessorUrl = new URL('./tts-processor.js', import.meta.url)

function isAudioWorkletSupported(ctx) {
  return typeof ctx.audioWorklet?.addModule === 'function'
}

export class ReusablePCMPlayer {
  constructor({
    sampleRate = 24000,
    channels = 1,
    bufferSize = 4096,
    maxBufferSeconds = 20,
  } = {}) {
    this.sampleRate = sampleRate
    this.channels = channels
    this.bufferSize = bufferSize
    this.maxBufferSeconds = maxBufferSeconds
    this.maxLen = sampleRate * maxBufferSeconds * channels
    this.readIndex = 0
    this.writeIndex = 0
    this.available = 0
    this._ended = false
    this.buffer = new Float32Array(this.maxLen)
    this.waitingChunks = []
    this.waitingStart = false
    this.isStop = false
    this.onEnded = () => {}
  }

  init() {
    this._ended = false
    this.readIndex = 0
    this.writeIndex = 0
    this.available = 0
    this.waitingChunks = []
    this.waitingStart = false
    this.isStop = false
    this.buffer = new Float32Array(this.maxLen)

    const { channels, bufferSize } = this
    if (isAudioWorkletSupported(this.audioCtx)) {
      this.audioCtx.audioWorklet.addModule(ttsProcessorUrl).then(() => {
        this.worklet = new AudioWorkletNode(this.audioCtx, 'tts-processor')
        this.worklet.connect(this.audioCtx.destination)
        this.worklet.port.onmessage = (event) => {
          if (event.data.type === 'ended' && this._ended) {
            this._ended = false
            this.onEnded?.()
          }
        }
      })
    } else {
      this.scriptNode = this.audioCtx.createScriptProcessor(bufferSize, 0, channels)
      this.scriptNode.connect(this.audioCtx.destination)
      this.scriptNode.onaudioprocess = this._onAudioProcess.bind(this)
    }
  }

  signalEndOfStream() {
    this._ended = true
    if (this.worklet) {
      this.worklet.port.postMessage({ type: 'ended' })
    }
  }

  _onAudioProcess(e) {
    for (let ch = 0; ch < this.channels; ch++) {
      const output = e.outputBuffer.getChannelData(ch)
      if (this.available >= output.length) {
        for (let i = 0; i < output.length; i++) {
          output[i] = this.buffer[(this.readIndex + i) % this.maxLen]
        }
        this.readIndex = (this.readIndex + output.length) % this.maxLen
        this.available -= output.length
      } else {
        output.fill(0)
        if (this._ended) {
          setTimeout(() => {
            if (this._ended) {
              this.scriptNode.disconnect()
              this._ended = false
              this.onEnded?.()
            }
          }, 200)
        }
      }
    }
  }

  pushPCMChunk(chunk) {
    const len = chunk.length
    if (this.waitingStart || this.available + len > this.maxLen) {
      this.waitingChunks.push(chunk)
      if (!this.waitingStart) this.flush()
      this.waitingStart = true
      return
    }
    this.setBuffer(chunk)
  }

  flush() {
    if (!this.waitingChunks.length || this.isStop) return
    this.timeoutId = setTimeout(() => {
      if (this.available < this.maxLen / 2) {
        const chunk = this.waitingChunks.shift()
        if (chunk) this.setBuffer(chunk)
      }
      this.flush()
    }, 200)
  }

  setBuffer(chunk) {
    const len = chunk.length
    for (let i = 0; i < len; i++) {
      this.buffer[(this.writeIndex + i) % this.maxLen] = chunk[i]
    }
    this.writeIndex = (this.writeIndex + len) % this.maxLen
    this.available += len
  }

  pushBase64(b64) {
    const pcm16 = base64ToPCM(b64)
    const float32 = new Float32Array(pcm16.length)
    const amplificationFactor = 2.0
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = (pcm16[i] / 32768) * amplificationFactor
      float32[i] = Math.max(-1, Math.min(1, float32[i]))
    }
    if (this.worklet) {
      this.worklet.port.postMessage({ type: 'push', data: float32 })
    } else {
      this.pushPCMChunk(float32)
    }
    return pcm16
  }

  async start(onEnded) {
    this.audioCtx ||= new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.sampleRate,
    })
    this.init()
    this.onEnded = onEnded
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume()
    }
  }

  stop() {
    this.isStop = true
    if (this.worklet) {
      this.worklet.port.postMessage({ type: 'stop' })
    } else if (this.scriptNode) {
      this.scriptNode.disconnect()
      clearTimeout(this.timeoutId)
    }
  }
}

export const sharedPlayer = new ReusablePCMPlayer({
  sampleRate: 24000,
  channels: 1,
  bufferSize: 4096,
  maxBufferSeconds: 20,
})

export function mergePCM16Chunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Int16Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
