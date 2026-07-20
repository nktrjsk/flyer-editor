import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import PreviewPane, { fitTitles, markOverflow } from '../components/PreviewPane'
import type { ConceptMeta } from '../types'

export interface PreviewFacts {
  pages: number
  overflow: boolean
  overflowingPages: number[]
  titleFitPt: number[]
}

/** Render a concept's content into a hidden A5 preview off-screen, wait for
 *  fonts + layout, run the SAME fit/overflow measurement the live preview uses,
 *  then read the facts and tear it down. Never touches the active concept. */
export async function measurePreviewFacts(meta: ConceptMeta, markdown: string): Promise<PreviewFacts> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  // Off-screen but still laid out (NOT display:none, which zeroes measurements).
  host.style.cssText = 'position:fixed; left:-100000px; top:0; width:1200px; pointer-events:none;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(createElement(PreviewPane, { meta, markdown }))
    await document.fonts.ready
    // two rAFs so the commit + layout settle before we measure
    await new Promise<void>(res => requestAnimationFrame(() => requestAnimationFrame(() => res())))
    fitTitles(host)
    markOverflow(host)
    const pageEls = Array.from(host.querySelectorAll<HTMLElement>('.page'))
    const overflowingPages: number[] = []
    pageEls.forEach((p, i) => { if (p.classList.contains('is-overflowing')) overflowingPages.push(i) })
    const titleFitPt: number[] = []
    host.querySelectorAll<HTMLElement>('.page-title').forEach(el => {
      const pt = parseFloat(el.style.fontSize)
      if (!Number.isNaN(pt)) titleFitPt.push(pt)
    })
    return { pages: pageEls.length, overflow: overflowingPages.length > 0, overflowingPages, titleFitPt }
  } finally {
    root.unmount()
    host.remove()
  }
}
