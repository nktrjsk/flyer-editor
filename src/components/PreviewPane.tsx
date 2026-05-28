import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ConceptMeta } from '../types'
import Page from './Page'

interface PreviewPaneProps {
  meta: ConceptMeta
  markdown: string
}

function fitTitles(pane: HTMLElement) {
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

export default function PreviewPane({ meta, markdown }: PreviewPaneProps) {
  const paneRef = useRef<HTMLDivElement>(null)
  const fontsReady = useRef(false)

  useEffect(() => {
    document.fonts.ready.then(() => {
      fontsReady.current = true
      if (paneRef.current) fitTitles(paneRef.current)
    })
  }, [])

  useLayoutEffect(() => {
    if (fontsReady.current && paneRef.current) fitTitles(paneRef.current)
  })

  const sections = markdown.split(/\n\s*---\s*\n/)

  return (
    <div className="preview-pane" id="preview" ref={paneRef}>
      {sections.map((section, i) => (
        <Page
          key={i}
          section={section}
          meta={meta}
          isFirst={i === 0}
          pageIndex={i}
          total={sections.length}
        />
      ))}
    </div>
  )
}
