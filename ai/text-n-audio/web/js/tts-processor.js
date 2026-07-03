/* AudioWorklet: queue Float32 PCM chunks for TTS playback */

class ChunkQueue {
  constructor() {
    this.chunks = [];
    this.currentChunk = null;
    this.offset = 0;
    this.computed = false;
  }

  push(chunk) {
    this.chunks.push(chunk);
  }

  pull(output) {
    try {
      let written = 0;
      while (written < output.length) {
        if (!this.currentChunk) {
          if (this.chunks.length === 0) {
            output.fill(0);
            return this.computed;
          }
          this.currentChunk = this.chunks.shift();
          this.offset = 0;
        }

        const chunk = this.currentChunk;
        const remaining = chunk.length - this.offset;
        const toCopy = Math.min(output.length - written, remaining);
        output.set(chunk.subarray(this.offset, this.offset + toCopy), written);
        this.offset += toCopy;
        written += toCopy;

        if (this.offset >= chunk.length) {
          this.currentChunk = null;
        }
      }
      return false;
    } catch {
      output.fill(0);
      return false;
    }
  }

  ended() {
    this.computed = true;
  }

  clear() {
    this.chunks = [];
    this.currentChunk = null;
    this.offset = 0;
    this.computed = false;
  }
}

class TTSProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = new ChunkQueue();
    this.isRunning = true;
    this.port.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'push') {
        this.queue.push(data);
      } else if (type === 'stop') {
        this.queue.clear();
        this.isRunning = false;
      } else if (type === 'ended') {
        this.queue.ended();
      }
    };
  }

  process(_inputs, outputs) {
    if (!this.isRunning) return false;
    const output = outputs[0][0];
    const isComputed = this.queue.pull(output);
    if (isComputed) {
      this.port.postMessage({ type: 'ended' });
    }
    return !isComputed;
  }
}

registerProcessor('tts-processor', TTSProcessor);
