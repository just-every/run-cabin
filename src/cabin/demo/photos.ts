// Small PNG "photos" of a made-up room for the demo's completed turnovers: a
// wall, a window, a bed with fresh linen and a rug, in each home's own colours.
const W = 160, H = 120
type RGB = [number, number, number]
const palettes: { wall: RGB; floor: RGB; blanket: RGB; rug: RGB }[] = [
  { wall: [222, 210, 188], floor: [140, 98, 64], blanket: [53, 108, 96], rug: [176, 72, 52] },
  { wall: [200, 214, 206], floor: [118, 86, 60], blanket: [70, 90, 140], rug: [210, 180, 120] },
  { wall: [236, 226, 214], floor: [160, 120, 84], blanket: [150, 60, 60], rug: [90, 120, 90] },
  { wall: [214, 222, 232], floor: [104, 80, 62], blanket: [196, 150, 70], rug: [60, 80, 110] },
]

function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) } return (crc ^ 0xffffffff) >>> 0 }
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer)
  view.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length))); return out
}
async function deflate(raw: Uint8Array<ArrayBuffer>) { return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()) }

/** A PNG of the room as the cleaner left it; `variant` moves the bed and window. */
export async function roomPhoto(variant: number): Promise<Uint8Array> {
  const p = palettes[variant % palettes.length], shift = (variant * 13) % 40
  const raw = new Uint8Array(H * (1 + W * 3))
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0
    for (let x = 0; x < W; x++) {
      let c: RGB = y < 78 ? p.wall : p.floor
      if (y >= 78 && (x + y) % 23 === 0) c = [p.floor[0] - 18, p.floor[1] - 14, p.floor[2] - 10]
      if (x >= 96 - shift && x < 136 - shift && y >= 14 && y < 50) c = (x === 116 - shift || y === 32) ? [250, 250, 250] : [150, 196, 230]
      if (x >= 18 + shift && x < 92 + shift && y >= 56 && y < 96) c = y < 66 ? [245, 245, 242] : y < 72 ? [232, 232, 228] : p.blanket
      if (x >= 18 + shift && x < 22 + shift && y >= 44 && y < 100) c = [92, 64, 44]
      if (x >= 10 && x < 150 && y >= 104 && y < 116 && !(x >= 18 + shift && x < 92 + shift && y < 100)) c = p.rug
      raw.set(c, y * (1 + W * 3) + 1 + x * 3)
    }
  }
  const header = new Uint8Array(13), view = new DataView(header.buffer)
  view.setUint32(0, W); view.setUint32(4, H); header.set([8, 2, 0, 0, 0], 8)
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array())]
  const png = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let at = 0
  for (const part of parts) { png.set(part, at); at += part.length }
  return png
}

export function base64(bytes: Uint8Array) { let binary = ''; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary) }
