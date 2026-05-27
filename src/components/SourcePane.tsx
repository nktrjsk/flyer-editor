import type { ConceptMeta } from '../types'
import MetaSection from './MetaSection'
import MarkdownEditor from './MarkdownEditor'

interface SourcePaneProps {
  meta: ConceptMeta
  markdown: string
  onMetaChange: (patch: Partial<ConceptMeta>) => void
  onMarkdownChange: (md: string) => void
}

export default function SourcePane({ meta, markdown, onMetaChange, onMarkdownChange }: SourcePaneProps) {
  return (
    <div className="source-pane">
      <MetaSection meta={meta} onChange={onMetaChange} />
      <MarkdownEditor value={markdown} onChange={onMarkdownChange} />
    </div>
  )
}
