// Camera images are reduced before either local storage or authenticated upload.
export async function shrink(file) {
  const limit = 250_000
  if (['image/jpeg', 'image/png'].includes(file.type) && file.size <= limit) return file
  const image = await createImageBitmap(file), canvas = document.createElement('canvas')
  try {
    for (const [edge, quality] of [[1600, .82], [1280, .75], [1024, .7], [800, .65], [640, .6]]) {
      const scale = Math.min(1, edge / Math.max(image.width, image.height))
      canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', quality))
      if (blob && blob.size <= limit) return blob
    }
  } finally { image.close() }
  throw Error(`${file.name || 'A photo'} is too large to send.`)
}
export async function encoded(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { photo: btoa(binary), mimeType: blob.type }
}
export function fields(form) {
  const input = {}
  for (const [key, value] of new FormData(form)) if (key !== 'photoFiles') input[key] = ['checks', 'removePhotoIds'].includes(key) ? [...(input[key] ?? []), value] : value
  return input
}
