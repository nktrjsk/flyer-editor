/**
 * PNG/JPEG export of the rendered flyer, one image file per page.
 *
 * html-to-image is loaded lazily (dynamic import) so it never enters the main
 * bundle — only users who actually trigger an export pay for it. Independent
 * of `flyerScreenshot.ts` (the AI bridge's stacked-preview capture): this is a
 * separate user-facing feature with its own scale and per-page output.
 */
import { getCachedFontEmbedCSS } from './fontEmbedCss'

const PIXEL_RATIO = 3

export type ExportFormat = 'png' | 'jpeg'

/** Capture every `.page` in the preview and download each as its own image file. */
export async function exportFlyerImages(format: ExportFormat, baseName: string): Promise<void> {
  const pages = Array.from(document.querySelectorAll<HTMLElement>('#preview .page'))
  if (pages.length === 0) throw new Error('Žádná stránka k exportu.')

  // Wait for fonts so text isn't captured mid-swap.
  await document.fonts.ready

  const htmlToImage = await import('html-to-image')

  // html-to-image has a known "first capture renders blank" quirk in some
  // browsers — do one throwaway capture to warm it up before the real loop.
  await htmlToImage.toPng(pages[0], { pixelRatio: 1 })

  const fontEmbedCSS = await getCachedFontEmbedCSS(pages[0])

  const ext = format === 'png' ? 'png' : 'jpg'
  const total = pages.length

  for (let i = 0; i < total; i++) {
    const dataUrl = format === 'png'
      ? await htmlToImage.toPng(pages[i], { pixelRatio: PIXEL_RATIO, backgroundColor: '#ffffff', fontEmbedCSS })
      : await htmlToImage.toJpeg(pages[i], { pixelRatio: PIXEL_RATIO, backgroundColor: '#ffffff', quality: 0.92, fontEmbedCSS })

    const suffix =
      total === 1 ? '' :
      i === 0 ? '-predni' :
      i === 1 ? '-zadni' :
      `-${i + 1}`
    const filename = `${baseName}${suffix}.${ext}`

    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    // Some browsers require the anchor to be in the DOM before .click().
    document.body.appendChild(a)
    a.click()
    a.remove()

    // Small gap between downloads so browsers don't drop/block rapid sequential ones.
    if (i < total - 1) await new Promise(r => setTimeout(r, 150))
  }
}
