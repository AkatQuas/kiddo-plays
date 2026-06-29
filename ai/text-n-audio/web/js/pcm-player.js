/**
 * Framework-agnostic PCM player (ported from usePCMPlayer/index.ts)
 */
import { postSSE } from './sse-client.js'
import { mergePCM16Chunks, sharedPlayer as player } from './reusable-pcm-player.js'

export function createPCMPlayer({ url }) {
  let stopFn = null
  let loading = false
  let isPlaying = false
  const listeners = new Set()

  function emit() {
    listeners.forEach((fn) => fn({ loading, isPlaying }))
  }

  function setLoading(v) {
    loading = v
    emit()
  }

  function setPlaying(v) {
    isPlaying = v
    emit()
  }

  function play(data) {
    stopFn?.()
    const abortController = new AbortController()
    stopFn = () => {
      setPlaying(false)
      player.stop()
      setLoading(false)
      abortController.abort()
    }

    setLoading(true)
    player.start(() => {
      setPlaying(false)
      stopFn = null
      emit()
    })

    const pcms = []
    return new Promise((resolve, reject) => {
      postSSE(url, data, {
        signal: abortController.signal,
        onmessage(res) {
          setPlaying(true)
          setLoading(false)
          if (res.data) {
            const pcm16 = player.pushBase64(res.data)
            pcms.push(pcm16)
          }
          if (res.event === 'done') {
            player.signalEndOfStream()
            resolve(mergePCM16Chunks(pcms))
          }
        },
        onclose() {
          resolve('')
        },
        onerror(err) {
          reject(err)
        },
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          setLoading(false)
          setPlaying(false)
          player.signalEndOfStream()
          reject(err)
        }
      })
    })
  }

  return {
    get loading() {
      return loading
    },
    get isPlaying() {
      return isPlaying
    },
    onStateChange(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    play,
    toggle(data, callback) {
      if (isPlaying || loading) {
        stopFn?.()
      } else {
        play(data).then((buffer) => callback?.(buffer))
      }
    },
    stop() {
      setLoading(false)
      stopFn?.()
    },
  }
}
