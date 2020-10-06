import './style/index.scss'
import Stats from 'stats.js'
import worker from './main.clist'
const model = require('./wasmface/models/human-face')

const HEIGHT = 360

window.addEventListener('load', async () => {
  const video = document.createElement('video')
  video.setAttribute('autoplay', 'autoplay')

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
  })
  video.srcObject = stream

  const WIDTH = Math.floor(HEIGHT * (4 / 3)) // ToDo: fetch from source size

  const canvas = document.createElement('canvas')
  canvas.setAttribute('width', WIDTH.toString())
  canvas.setAttribute('height', HEIGHT.toString())
  document.body.appendChild(canvas)

  const stats = new Stats()
  document.body.appendChild(stats.dom)

  // Initialize WasmFace
  const mod = await worker.initialize()
  console.log(mod)
  const strPtr = mod.allocate(mod.intArrayFromString(JSON.stringify(model)), 0)
  const modelPtr = mod.ccall<number>('create', 'number', ['number'], [strPtr])
  mod._free(strPtr)

  const tick = () => {
    stats.begin()
    requestAnimationFrame(tick)
    const pp = 1,
      othresh = 0.3,
      nthresh = 5,
      step = 2.0,
      delta = 2.0

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, WIDTH, HEIGHT)
    const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT)

    const inputBuf = mod._malloc(imageData.data.length)
    mod.HEAPU8.set(imageData.data, inputBuf)
    const resultPtr =
      mod.ccall<number>(
        'detect',
        'number',
        [
          'number',
          'number',
          'number',
          'number',
          'number',
          'number',
          'number',
          'number',
          'number',
        ],
        [inputBuf, WIDTH, HEIGHT, modelPtr, step, delta, pp, othresh, nthresh]
      ) / Uint16Array.BYTES_PER_ELEMENT

    const len = mod.HEAPU16[resultPtr]
    const boxes: number[][] = []
    for (let i = 1; i < len; i += 3) {
      boxes.push([
        mod.HEAPU16[resultPtr + i + 0],
        mod.HEAPU16[resultPtr + i + 1],
        mod.HEAPU16[resultPtr + i + 2],
      ])
    }

    mod._free(inputBuf)
    mod._free(resultPtr)

    for (const box of boxes) {
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.rect(box[0], box[1], box[2], box[2])
      ctx.stroke()
    }

    stats.end()
  }

  requestAnimationFrame(tick)
})
