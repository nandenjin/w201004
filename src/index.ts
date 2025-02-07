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
  const MEM_SIZE = 200

  /** Address for raw level memory */
  const rawMemPtr = mod._malloc(MEM_SIZE * Float32Array.BYTES_PER_ELEMENT)
  mod.HEAPF32.fill(
    0,
    rawMemPtr / Float32Array.BYTES_PER_ELEMENT,
    rawMemPtr / Float32Array.BYTES_PER_ELEMENT + MEM_SIZE
  )

  /** Index cursor for raw level memory */
  let cursorIndex = 0

  /** Address for result memory */
  const resultAmpPtr = mod._malloc(MEM_SIZE * Float32Array.BYTES_PER_ELEMENT)

  /** Time of last rendered frame */
  let lastRenderedTime = 0

  /** Delta times between rendered frames */
  const frameDeltas = new Float32Array(MEM_SIZE)

  const videoCanvas = document.createElement('canvas')
  videoCanvas.setAttribute('width', WIDTH.toString())
  videoCanvas.setAttribute('height', HEIGHT.toString())
  document.body.appendChild(videoCanvas)

  const graphCanvas = document.createElement('canvas')
  graphCanvas.setAttribute('width', MEM_SIZE.toString())
  graphCanvas.setAttribute('height', '100')
  document.body.appendChild(graphCanvas)

  const stats = new Stats()
  document.body.appendChild(stats.dom)

  const tick = () => {
    requestAnimationFrame(tick)

    // Begin of fps stats
    stats.begin()

    /** Current unix time */
    const now = Date.now()

    const videoCtx = videoCanvas.getContext('2d')
    if (!videoCtx) return

    // Draw video source on canvas
    videoCtx.drawImage(video, 0, 0, WIDTH, HEIGHT)

    /** Data of latest video frame */
    const imageData = videoCtx.getImageData(0, 0, WIDTH, HEIGHT)

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

        // MEM_SIZE
        'number',

        // cursorIndex
        'number',

        // resultPtr
        'number',
      ],
      [
        inputBuf,
        WIDTH,
        HEIGHT,
        ...faceBox,
        rawMemPtr,
        MEM_SIZE,
        cursorIndex,
        resultAmpPtr,
      ]
    )

    // Free source video frame
    mod._free(inputBuf)

    const amp = mod.HEAPF32.subarray(
      resultAmpPtr / Float32Array.BYTES_PER_ELEMENT,
      resultAmpPtr / Float32Array.BYTES_PER_ELEMENT + MEM_SIZE
    )
    const ampMax = Math.max(...amp)

    const graphCtx = graphCanvas.getContext('2d')
    if (!graphCtx) return

    graphCtx.clearRect(0, 0, MEM_SIZE, 100)
    graphCtx.fillStyle = 'green'
    console.log(amp)
    for (let i = 0; i < MEM_SIZE; i++) {
      graphCtx.fillRect(
        i,
        (1 - amp[i] / ampMax) * 100,
        1,
        (amp[i] / ampMax) * 100
      )
    }

    // Draw bounding box on canvas
    videoCtx.strokeStyle = 'red'
    videoCtx.lineWidth = 3
    videoCtx.beginPath()
    videoCtx.rect(faceBox[0], faceBox[1], faceBox[2], faceBox[2])
    videoCtx.stroke()

    // Log delta time
    frameDeltas[cursorIndex] = now - lastRenderedTime
    lastRenderedTime = now

    // Increment cursor
    cursorIndex++
    if (cursorIndex >= MEM_SIZE) cursorIndex = 0

    // End of fps stats
    stats.end()
  }

  requestAnimationFrame(tick)
})
