import { useLayoutEffect, useRef } from 'react'
import { marked } from 'marked'
import type { ConceptMeta } from '../types'

interface PageProps {
  section: string
  meta: ConceptMeta
  isFirst: boolean
  pageIndex: number
  total: number
  /** When provided, the title is edited directly on the page. */
  onTitleChange?: (title: string) => void
}

/**
 * The flyer title, edited in place on the page. Uncontrolled contenteditable:
 * the DOM is only overwritten when the value changed elsewhere (concept
 * switch, restore, AI edit), so the caret survives typing and the title
 * auto-fit that rewrites font-size on every input.
 */
function EditableTitle({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if ((el.textContent ?? '') !== value) el.textContent = value
    // Browsers leave a lone <br> behind when a contenteditable is emptied,
    // which defeats the :empty placeholder — strip it.
    else if (value === '' && el.firstChild) el.textContent = ''
  })
  return (
    <div
      className="page-title"
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-label="Název letáku"
      data-placeholder="Název letáku"
      onInput={e => onChange((e.currentTarget.textContent ?? '').replace(/\n+/g, ' '))}
      onKeyDown={e => {
        // The title is a single line; Enter/Escape end editing instead.
        if (e.key === 'Enter') e.preventDefault()
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
      }}
    />
  )
}

export default function Page({ section, meta, isFirst, pageIndex, total, onTitleChange }: PageProps) {
  const labelText =
    total === 1 ? 'Náhled' :
    pageIndex === 0 ? 'Přední strana' :
    pageIndex === 1 ? 'Zadní strana' :
    `Strana ${pageIndex + 1}`

  const html = marked.parse(section.trim(), { gfm: true }) as string
  const metaLine = [meta.org, meta.year].filter(Boolean).join(' · ')

  return (
    <>
      <div className="page-label">{labelText}</div>
      <div className="page" data-palette={meta.palette} style={{ '--base': `${meta.fontSize}pt` } as React.CSSProperties}>
        {isFirst && (
          <div className="page-title-block">
            <div className="page-title-area">
              {onTitleChange
                ? <EditableTitle value={meta.title} onChange={onTitleChange} />
                : <div className="page-title">{meta.title}</div>}
              <div className="page-meta">{metaLine}</div>
            </div>
            {meta.logo && (
              <img className="page-logo" src={meta.logo} alt="" />
            )}
          </div>
        )}
        <div
          className="page-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="page-footer">
          <span>{meta.org}</span>
          <span>{meta.web ? `${meta.web} · ` : ''}CC BY-SA 4.0</span>
        </div>
      </div>
    </>
  )
}
