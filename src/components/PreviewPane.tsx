import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ConceptMeta } from '../types'
import Page from './Page'

interface PreviewPaneProps {
  meta: ConceptMeta
  markdown: string
  /** Enables in-place title editing — passed only by the live editor, never
      by read-only previews (history explorer, boot placeholder). */
  onTitleChange?: (title: string) => void
}

export function fitTitles(pane: HTMLElement) {
  pane.querySelectorAll<HTMLElement>('.page-title').forEach(el => {
    const max = 34, min = 20

    // overflow:hidden lets scrollWidth report natural text width
    // while offsetWidth reflects the constrained container width
    el.style.overflow = 'hidden'
    el.style.whiteSpace = 'nowrap'
    el.style.fontSize = `${max}pt`

    let size = max
    while (el.scrollWidth > el.offsetWidth && size > min) {
      size -= 0.5
      el.style.fontSize = `${size}pt`
    }

    // Still doesn't fit at minimum size → wrap instead
    if (el.scrollWidth > el.offsetWidth) {
      el.style.whiteSpace = 'normal'
    }

    // Restore so descenders aren't clipped in the final render
    el.style.overflow = 'visible'
  })
}

// Flag pages whose content is clipped by the fixed A5 height. The content
// area has overflow:hidden, so scrollHeight (full content) exceeding
// clientHeight (visible box) means text is being cut off the page.
export function markOverflow(pane: HTMLElement) {
  let anyOverflow = false
  pane.querySelectorAll<HTMLElement>('.page').forEach(page => {
    const content = page.querySelector<HTMLElement>('.page-content')
    if (!content) return
    // 1px tolerance avoids false positives from sub-pixel rounding
    const overflowing = content.scrollHeight - content.clientHeight > 1
    page.classList.toggle('is-overflowing', overflowing)
    if (overflowing) anyOverflow = true
  })
  // Drives the always-on overflow top bar — visible regardless of scroll
  // position, so overflow is noticed without scrolling down to the clipped page.
  pane.classList.toggle('has-overflow', anyOverflow)
}

export default function PreviewPane({ meta, markdown, onTitleChange }: PreviewPaneProps) {
  const paneRef = useRef<HTMLDivElement>(null)
  const fontsReady = useRef(false)

  useEffect(() => {
    document.fonts.ready.then(() => {
      fontsReady.current = true
      if (paneRef.current) {
        fitTitles(paneRef.current)
        markOverflow(paneRef.current)
      }
    })
  }, [])

  useLayoutEffect(() => {
    if (fontsReady.current && paneRef.current) {
      fitTitles(paneRef.current)
      markOverflow(paneRef.current)
    }
  })

  const sections = markdown.split(/\n\s*---\s*\n/)

  return (
    <div className="preview-pane" id="preview" ref={paneRef}>
      <div className="overflow-flag">⚠ Obsah přesahuje stránku — část textu se nevejde a nevytiskne se</div>
      {sections.map((section, i) => (
        <Page
          key={i}
          section={section}
          meta={meta}
          isFirst={i === 0}
          pageIndex={i}
          total={sections.length}
          onTitleChange={onTitleChange}
        />
      ))}
    </div>
  )
}
