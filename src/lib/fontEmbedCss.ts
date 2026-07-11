/**
 * Caches html-to-image's getFontEmbedCSS() output across calls.
 *
 * html-to-image re-fetches every @font-face declaration on every capture by
 * default, which is slow and can be flaky. Now that fonts are self-hosted
 * (same-origin), we compute the embed CSS once per session and reuse it via
 * the `fontEmbedCSS` option on subsequent captures.
 */
let cached: string | null = null

export async function getCachedFontEmbedCSS(node: HTMLElement): Promise<string> {
  if (cached !== null) return cached
  try {
    const htmlToImage = await import('html-to-image')
    cached = await htmlToImage.getFontEmbedCSS(node)
  } catch {
    cached = ''
  }
  return cached
}
