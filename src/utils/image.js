// Read an uploaded image File and return a downscaled PNG data URL, so a business
// logo can be stored inline in settings (and synced/transferred) without bloating
// the payload. Downscales to fit `maxDim` px on the long edge via canvas; falls
// back to the raw data URL where canvas is unavailable.
export function fileToLogoDataUrl(file, maxDim = 240) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('read failed'))
    reader.onload = () => {
      const dataUrl = reader.result
      const img = new Image()
      img.onerror = () => resolve(dataUrl) // can't decode → keep the raw data URL
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1))
          const w = Math.max(1, Math.round((img.width || 1) * scale))
          const h = Math.max(1, Math.round((img.height || 1) * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) { resolve(dataUrl); return }
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/png'))
        } catch {
          resolve(dataUrl)
        }
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}
