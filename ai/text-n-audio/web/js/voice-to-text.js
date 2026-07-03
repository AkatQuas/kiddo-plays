/**
 * Framework-agnostic voice capture
 */
import { createAudioVisualizer } from './audio-visualizer.js';

export function createVoiceToText({
  sampleRate = 24000,
  numOfChannels = 1,
  emitStreamChunks = true,
  onTranscription,
  onTranscriptionStop,
  onError,
  visualizerConfig
} = {}) {
  const visualizer = createAudioVisualizer(visualizerConfig);
  visualizer.setupCanvas();

  let isRecording = false;
  let permissionReading = false;
  let stopping = false;
  let isRecordingRef = false;
  let stopEffect = null;

  function blobFromWorkletData(data) {
    return new Blob(data.blobData, { type: data.mimeType });
  }

  async function start() {
    if (isRecording || permissionReading || stopping) return;

    if (
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      onError?.(new Error('Microphone requires HTTPS or localhost'));
      return;
    }

    permissionReading = true;
    isRecordingRef = true;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      permissionReading = false;
      isRecordingRef = false;
      onError?.(err);
      return;
    } finally {
      permissionReading = false;
    }

    if (!isRecordingRef) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    isRecording = true;
    visualizer.initCanvas();

    const audioContext = new AudioContext({ sampleRate });
    await audioContext.resume();

    const manualStop = { status: true };
    const source = audioContext.createMediaStreamSource(stream);

    visualizer.initAnalyzer(audioContext, source);
    visualizer.start();

    const workletUrl = new URL('./pcm-processor.js', import.meta.url);
    await audioContext.audioWorklet.addModule(workletUrl);

    const processor = new AudioWorkletNode(audioContext, 'pcm-processor', {
      processorOptions: {
        sampleRate: audioContext.sampleRate,
        numChannels: numOfChannels,
        emitStreamChunks
      }
    });

    source.connect(processor).connect(audioContext.destination);

    processor.port.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === 'source') {
        if (!manualStop.status) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        onTranscription?.(blobFromWorkletData(data), manualStop);
      }
      if (type === 'close') {
        processor.port.postMessage({ close: true });
        onTranscriptionStop?.(data ? blobFromWorkletData(data) : undefined);
        stopping = false;
      }
    };

    stopEffect = (options = {}) => {
      isRecording = false;
      isRecordingRef = false;
      visualizer.stop();
      processor.port.postMessage({ stop: true });
      processor.disconnect();
      source.disconnect();
      audioContext.close();
      stream.getTracks().forEach((track) => track.stop());
      manualStop.status = options.manual ?? true;
      stopEffect = null;
    };
  }

  function stop(options = {}) {
    isRecordingRef = false;
    if (stopping || permissionReading) return;
    if (isRecording && stopEffect) stopping = true;
    stopEffect?.(options);
  }

  function toggle() {
    if (permissionReading || stopping) return;
    if (isRecording) stop();
    else start();
  }

  return {
    canvas: visualizer.canvas,
    get isRecording() {
      return isRecording;
    },
    get permissionReading() {
      return permissionReading;
    },
    get stopping() {
      return stopping;
    },
    start,
    stop,
    toggle
  };
}
