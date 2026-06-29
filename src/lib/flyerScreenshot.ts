/**
 * Approximate PNG of the rendered flyer for the AI bridge's get_screenshot.
 *
 * html2canvas is loaded lazily (dynamic import) so it never enters the main
 * bundle — only users who actually trigger an AI screenshot pay for it.
 *
 * APPROXIMATE by nature: html2canvas re-implements CSS, so web fonts, filters
 * and the logo data-URL can render slightly off. Hard facts travel via
 * get_state; this image is a nice-to-have. See docs/ai-bridge.md.
 */
const SCALE = 1.5
const GAP = 16 // px between stacked pages, at SCALE 1

/** Capture every `.page` in the preview, stacked vertically, as one PNG. */
export async function captureFlyerPng(): Promise<{ mimeType: string; base64: string }> {
  const pages = Array.from(document.querySelectorAll<HTMLElement>('#preview .page'))
  if (pages.length === 0) throw new Error('Žádná stránka k zachycení.')

  // Wait for fonts so text isn't captured mid-swap.
  await document.fonts.ready

  const { default: html2canvas } = await import('html2canvas')

  const canvases: HTMLCanvasElement[] = []
  for (const page of pages) {
    canvases.push(
      await html2canvas(page, { backgroundColor: '#ffffff', scale: SCALE, useCORS: true, logging: false }),
    )
  }

  if (canvases.length === 1) {
    return toResult(canvases[0])
  }

  // Compose multiple pages onto one tall canvas.
  const gap = GAP * SCALE
  const width = Math.max(...canvases.map(c => c.width))
  const height = canvases.reduce((sum, c) => sum + c.height, 0) + gap * (canvases.length - 1)
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Nelze vytvořit plátno.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  let y = 0
  for (const c of canvases) {
    ctx.drawImage(c, 0, y)
    y += c.height + gap
  }
  return toResult(out)
}

function toResult(canvas: HTMLCanvasElement): { mimeType: string; base64: string } {
  const dataUrl = canvas.toDataURL('image/png')
  return { mimeType: 'image/png', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}
