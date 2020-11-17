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

  /** Face bounding box */
  const faceBox = new Uint16Array(3)

  /** The last update time of faceBox */
  let faceBoxLastUpdated = 0

  /** Size of raw level memory */
  const RAW_MEM_SIZE = 200

  /** Address for raw level memory */
  const rawMemPtr = mod._malloc(RAW_MEM_SIZE * Float32Array.BYTES_PER_ELEMENT)

  /** Index cursor for raw level memory */
  let rawMemPtrIndex = 0

  /** Address for result memory (real) */
  const resultRealPtr = mod._malloc(
    RAW_MEM_SIZE * Float32Array.BYTES_PER_ELEMENT
  )

  /** Address for result memory (imag) */
  const resultImagPtr = mod._malloc(
    RAW_MEM_SIZE * Float32Array.BYTES_PER_ELEMENT
  )

  const tick = () => {
    requestAnimationFrame(tick)

    // Begin of fps stats
    stats.begin()

    /** Current unix time */
    const now = Date.now()

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw video source on canvas
    ctx.drawImage(video, 0, 0, WIDTH, HEIGHT)

    /** Data of latest video frame */
    const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT)

    /** Address of video frame */
    const inputBuf = mod._malloc(imageData.data.length)
    mod.HEAPU8.set(imageData.data, inputBuf)

    // Exec face detection for each 200ms
    if (faceBoxLastUpdated < now - 200) {
      // Params for wasmface
      const pp = 1,
        othresh = 0.3,
        nthresh = 5,
        step = 2.0,
        delta = 2.0

      /** Address of result of face detection */
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

      /** Length of result bounding boxes */
      const len = mod.HEAPU16[resultPtr]

      // If result contains one or more boxes
      for (let i = 1; i < Math.min(len, 1 + 3); i += 3) {
        faceBox.set([
          mod.HEAPU16[resultPtr + i + 0],
          mod.HEAPU16[resultPtr + i + 1],
          mod.HEAPU16[resultPtr + i + 2],
        ])
      }

      // Free detection result
      mod._free(resultPtr)

      // Update time
      faceBoxLastUpdated = now
    }

    mod.ccall<number>(
      'tick',
      'number',
      [
        // inputBuf
        'number',

        // width, height
        'number',
        'number',

        // faceBox[]
        'number',
        'number',
        'number',

        // rawMemPtr
        'number',

        // RAW_MEM_SIZE
        'number',

        // rawMemPtrIndex
        'number',

        // resultPtr (real, imag)
        'number',
        'number',
      ],
      [
        inputBuf,
        WIDTH,
        HEIGHT,
        ...faceBox,
        rawMemPtr,
        RAW_MEM_SIZE,
        rawMemPtrIndex,
        resultRealPtr,
        resultImagPtr,
      ]
    )

    console.log(
      mod.HEAPF32.subarray(
        resultRealPtr / Float32Array.BYTES_PER_ELEMENT,
        resultRealPtr / Float32Array.BYTES_PER_ELEMENT + RAW_MEM_SIZE
      ).join('\n')
    )
    console.log(
      mod.HEAPF32.subarray(
        resultImagPtr / Float32Array.BYTES_PER_ELEMENT,
        resultImagPtr / Float32Array.BYTES_PER_ELEMENT + RAW_MEM_SIZE
      ).join('\n')
    )

    rawMemPtrIndex++
    if (rawMemPtrIndex >= RAW_MEM_SIZE) rawMemPtrIndex = 0

    // Free source video frame
    mod._free(inputBuf)

    // Draw bounding box on canvas
    ctx.strokeStyle = 'red'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.rect(faceBox[0], faceBox[1], faceBox[2], faceBox[2])
    ctx.stroke()

    // End of fps stats
    stats.end()
  }

  requestAnimationFrame(tick)
})
