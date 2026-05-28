import { marked } from 'marked'
import type { ConceptMeta } from '../types'

interface PageProps {
  section: string
  meta: ConceptMeta
  isFirst: boolean
  pageIndex: number
  total: number
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function Page({ section, meta, isFirst, pageIndex, total }: PageProps) {
  const labelText =
    total === 1 ? 'Náhled' :
    pageIndex === 0 ? 'Přední strana' :
    pageIndex === 1 ? 'Zadní strana' :
    `Strana ${pageIndex + 1}`

  const html = marked.parse(section.trim(), { gfm: true }) as string

  return (
    <>
      <div className="page-label">{labelText}</div>
      <div className="page" data-palette={meta.palette} style={{ '--base': `${meta.fontSize}pt` } as React.CSSProperties}>
        {isFirst && (
          <div className="page-title-block">
            <div className="page-title-area">
              <div className="page-title">{esc(meta.title)}</div>
              <div className="page-meta">
                {esc(meta.org)}{meta.year ? ` · ${esc(meta.year)}` : ''}
              </div>
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
          <span>{esc(meta.org)}</span>
          <span>{meta.web ? `${esc(meta.web)} · ` : ''}CC BY-SA 4.0</span>
        </div>
      </div>
    </>
  )
}
