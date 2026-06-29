/* AudioWorklet: capture mic PCM, emit WAV chunks (ported from ai.kit pcm-processor.ts) */

const setString = (view, offset, str) => {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

class WavAudioEncoder {
  constructor(opts) {
    this.sampleRate = opts.sampleRate
    this.numChannels = opts.numChannels
    this.numSamples = 0
    this.dataViews = []
  }

  encode(pcmData) {
    const sampleLength = pcmData[0].length
    const channelCount = this.numChannels
    const byteLength = sampleLength * channelCount * 2
    const view = new DataView(new ArrayBuffer(byteLength))

    let offset = 0
    for (let i = 0; i < sampleLength; i++) {
      for (let ch = 0; ch < channelCount; ch++) {
        const sample = pcmData[ch][i] * 0x7fff
        view.setInt16(
          offset,
          sample < 0 ? Math.max(sample, -0x8000) : Math.min(sample, 0x7fff),
          true,
        )
        offset += 2
      }
    }

    this.dataViews.push(view)
    this.numSamples += sampleLength
  }

  finish(mimeType = 'audio/wav') {
    const header = new DataView(new ArrayBuffer(44))
    const dataSize = this.numChannels * this.numSamples * 2

    setString(header, 0, 'RIFF')
    header.setUint32(4, 36 + dataSize, true)
    setString(header, 8, 'WAVE')
    setString(header, 12, 'fmt ')
    header.setUint32(16, 16, true)
    header.setUint16(20, 1, true)
    header.setUint16(22, this.numChannels, true)
    header.setUint32(24, this.sampleRate, true)
    header.setUint32(28, this.sampleRate * this.numChannels * 2, true)
    header.setUint16(32, this.numChannels * 2, true)
    header.setUint16(34, 16, true)
    setString(header, 36, 'data')
    header.setUint32(40, dataSize, true)

    const blobData = [header, ...this.dataViews]
    this.cleanup()
    return { blobData, mimeType }
  }

  cleanup() {
    this.dataViews = []
    this.numSamples = 0
  }
}

let encoder
let sampleRate = 44100
let numChannels = 1
let chunkSamples = sampleRate * 0.5
let currentSampleCount = 0
let emitStreamChunks = true

class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const opts = options?.processorOptions ?? {}
    sampleRate = opts.sampleRate
    numChannels = opts.numChannels
    emitStreamChunks = opts.emitStreamChunks !== false
    chunkSamples = sampleRate * 2
    encoder = new WavAudioEncoder({ sampleRate, numChannels })
    this.isRunning = true

    this.port.onmessage = (event) => {
      if (event.data.stop) {
        this.isRunning = false
        if (currentSampleCount > 0) {
          const blob = encoder.finish()
          encoder.cleanup()
          currentSampleCount = 0
          this.port.postMessage({ type: 'close', data: blob })
        } else {
          this.port.postMessage({ type: 'close' })
        }
      }
      if (event.data.close) {
        this.isRunning = false
      }
    }
  }

  static get parameterDescriptors() {
    return []
  }

  process(inputs) {
    if (!this.isRunning) return false
    if (!inputs.length || !inputs[0][0]) return true

    currentSampleCount += inputs[0][0].length
    encoder.encode(inputs[0])

    if (emitStreamChunks && currentSampleCount >= chunkSamples) {
      const blob = encoder.finish()
      encoder.cleanup()
      currentSampleCount = 0
      this.port.postMessage({ type: 'source', data: blob })
    }
    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
