/**
 * Canvas frequency visualizer (ported from useAudioVisualizer.ts)
 */
export function createAudioVisualizer(config = {}) {
  const {
    width = 48,
    height = 24,
    fftSize = 256,
    barColor = '#7c3aed',
    bgColor = 'transparent',
  } = config

  const canvas = document.createElement('canvas')
  let analyzer = null
  let animationId = null
  let dataArray = null

  const barWidth = 2
  const barSpacing = 1
  const centerY = height / 2
  const maxBarHeight = centerY - 4
  const totalBars = Math.floor((width + barWidth / 2) / (barWidth + barSpacing) / 2)
  const startX = (width - barWidth) / 2

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
  }

  function initCanvas() {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.strokeStyle = barColor
    ctx.stroke()
    ctx.closePath()
  }

  function initAnalyzer(audioContext, source) {
    analyzer = audioContext.createAnalyser()
    analyzer.fftSize = fftSize
    source.connect(analyzer)
    dataArray = new Uint8Array(analyzer.frequencyBinCount)
  }

  function draw() {
    if (!analyzer || !dataArray) return
    const ctx = canvas.getContext('2d')
    analyzer.getByteFrequencyData(dataArray)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = barColor

    const samplesPerBar = Math.floor(dataArray.length / totalBars)
    for (let i = 0; i < totalBars; i++) {
      const start = i * samplesPerBar
      const end = (i + 1) * samplesPerBar
      let maxVal = 0
      for (let j = start; j < end; j++) {
        if (dataArray[j] > maxVal) maxVal = dataArray[j]
      }
      const barHeight = Math.max((maxVal / 255) * maxBarHeight, 1)
      const tX = i * (barWidth + barSpacing)
      ;[tX, -tX].forEach((offset) => {
        const x = startX + offset
        ctx.fillRect(x, centerY - barHeight, barWidth, barHeight)
        ctx.fillRect(x, centerY, barWidth, barHeight)
      })
    }
    animationId = requestAnimationFrame(draw)
  }

  return {
    canvas,
    setupCanvas,
    initCanvas,
    initAnalyzer,
    start() {
      if (analyzer) draw()
    },
    stop() {
      if (animationId) cancelAnimationFrame(animationId)
      animationId = null
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, width, height)
    },
  }
}
