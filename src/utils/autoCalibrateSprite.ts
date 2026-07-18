import type { FrameAdjust } from '../components/PixelSpritePlayer'

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('無法讀取動畫圖'))
  image.src = src
})

const backgroundLike = (data: Uint8ClampedArray, offset: number) => {
  const r = data[offset], g = data[offset + 1], b = data[offset + 2], a = data[offset + 3]
  return a < 12 || (Math.min(r, g, b) >= 188 && Math.max(r, g, b) - Math.min(r, g, b) <= 28)
}

export async function autoCalibrateSpriteSheet(src: string): Promise<FrameAdjust[]> {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('瀏覽器無法分析動畫圖')
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  const width = canvas.width, height = canvas.height, visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0, tail = 0
  const enqueue = (x: number, y: number) => { const index = y * width + x;if (visited[index] || !backgroundLike(pixels,index * 4)) return;visited[index] = 1;queue[tail++] = index }
  for(let x=0;x<width;x++){enqueue(x,0);enqueue(x,height-1)}
  for(let y=1;y<height-1;y++){enqueue(0,y);enqueue(width-1,y)}
  while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);if(x)enqueue(x-1,y);if(x+1<width)enqueue(x+1,y);if(y)enqueue(x,y-1);if(y+1<height)enqueue(x,y+1)}

  const frameW = width / 2, frameH = height / 2
  const boxes = Array.from({length:4},(_,frame)=>{const ox=(frame%2)*frameW,oy=Math.floor(frame/2)*frameH;let left=frameW,top=frameH,right=-1,bottom=-1
    for(let y=0;y<frameH;y++)for(let x=0;x<frameW;x++){const global=(oy+y)*width+ox+x,offset=global*4;if(visited[global]||pixels[offset+3]<12)continue;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
    if(right<left||bottom<top)return {center:frameW/2,bottom:frameH*.9}
    return {center:(left+right)/2,bottom}
  })
  const targetCenter=boxes.reduce((sum,item)=>sum+item.center,0)/4,targetBottom=Math.max(...boxes.map(item=>item.bottom))
  return boxes.map(item=>({x:Number(((targetCenter-item.center)/frameW*100).toFixed(1)),y:Number(((targetBottom-item.bottom)/frameH*100).toFixed(1)),scale:90}))
}
