const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('圖片讀取失敗'))
  image.src = src
})

const isCheckerBackground = (r: number, g: number, b: number, a: number) => {
  const brightest = Math.max(r, g, b)
  const darkest = Math.min(r, g, b)
  return a < 12 || (darkest >= 225 && brightest - darkest <= 10)
}

/** Removes a light grey/white checkerboard that is connected to the image edge. */
export async function removePixelBackground(src: string) {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('瀏覽器無法處理圖片')
  context.imageSmoothingEnabled = false
  context.drawImage(image, 0, 0)
  const frame = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = frame
  const width = canvas.width
  const height = canvas.height
  let transparentPixels = 0
  for (let offset = 3; offset < data.length; offset += 4) if (data[offset] < 250) transparentPixels++
  // A real transparent PNG must never go through chroma removal: doing so can
  // incorrectly connect white clothes to the already transparent background.
  if (transparentPixels > width * height * .001) return src
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  const enqueue = (x: number, y: number) => {
    const index = y * width + x
    if (visited[index]) return
    const offset = index * 4
    if (!isCheckerBackground(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) return
    visited[index] = 1
    queue[tail++] = index
  }
  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1) }
  for (let y = 1; y < height - 1; y++) { enqueue(0, y); enqueue(width - 1, y) }

  while (head < tail) {
    const index = queue[head++]
    const x = index % width
    const y = Math.floor(index / width)
    data[index * 4 + 3] = 0
    if (x > 0) enqueue(x - 1, y)
    if (x + 1 < width) enqueue(x + 1, y)
    if (y > 0) enqueue(x, y - 1)
    if (y + 1 < height) enqueue(x, y + 1)
  }
  context.putImageData(frame, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Removes an edge-connected solid colour background (for green/blue screen art). */
export async function removeChromaKeyBackground(src: string, hexColor = '#00ff00', tolerance = 72) {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('無法建立去背畫布')
  context.drawImage(image, 0, 0)
  const frame = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = frame.data, width = canvas.width, height = canvas.height
  const rgb = hexColor.replace('#', '').match(/.{2}/g)?.map(value => Number.parseInt(value, 16)) ?? [0, 255, 0]
  const distance = (offset: number) => Math.hypot(data[offset] - rgb[0], data[offset + 1] - rgb[1], data[offset + 2] - rgb[2])
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height)
  let head = 0, tail = 0
  const edge = Math.max(8, tolerance * 1.35)
  const enqueue = (x: number, y: number) => {
    const index = y * width + x
    if (visited[index] || distance(index * 4) > edge) return
    visited[index] = 1
    queue[tail++] = index
  }
  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1) }
  for (let y = 1; y < height - 1; y++) { enqueue(0, y); enqueue(width - 1, y) }
  while (head < tail) {
    const index = queue[head++], x = index % width, y = Math.floor(index / width), offset = index * 4, delta = distance(offset)
    data[offset + 3] = delta <= tolerance ? 0 : Math.round(255 * (delta - tolerance) / Math.max(1, edge - tolerance))
    if (x > 0) enqueue(x - 1, y)
    if (x + 1 < width) enqueue(x + 1, y)
    if (y > 0) enqueue(x, y - 1)
    if (y + 1 < height) enqueue(x, y + 1)
  }
  context.putImageData(frame, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Automatically removes a green screen only when green occupies a meaningful part of the image border. */
export async function removeGreenScreenIfPresent(src: string, tolerance = 72) {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return src
  context.drawImage(image, 0, 0)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  const width = canvas.width, height = canvas.height, step = Math.max(1, Math.floor(Math.min(width, height) / 180))
  let samples = 0, green = 0, transparent = 0
  const inspect = (x: number, y: number) => {
    const offset = (y * width + x) * 4, alpha = data[offset + 3]
    samples++
    if (alpha < 20) transparent++
    if (Math.hypot(data[offset], data[offset + 1] - 255, data[offset + 2]) <= tolerance * 1.35) green++
  }
  for (let x = 0; x < width; x += step) { inspect(x, 0); inspect(x, height - 1) }
  for (let y = step; y < height - step; y += step) { inspect(0, y); inspect(width - 1, y) }
  if (transparent / samples > .08 || green / samples < .18) return src
  return removeChromaKeyBackground(src, '#00ff00', tolerance)
}
