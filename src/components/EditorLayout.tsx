import { useRef, useState } from 'react'
import type { ConceptMeta } from '../types'
import { useConcepts } from '../hooks/useConcepts'
import { useActiveConcept } from '../hooks/useActiveConcept'
import { useAutoSave } from '../hooks/useAutoSave'
import { useSnapshots } from '../hooks/useSnapshots'
import Sidebar from './Sidebar'
import SourcePane from './SourcePane'
import PreviewPane from './PreviewPane'
import type { ConceptId } from '../db/schema'

export default function EditorLayout() {
  const concepts = useConcepts()
  const {
    activeId,
    meta: savedMeta,
    markdown: savedMarkdown,
    selectConcept,
    createConcept,
    deleteConcept,
  } = useActiveConcept(concepts)

  // Local form state for instant UI response — auto-saved to Evolu
  const [meta, setMeta] = useState<ConceptMeta>(savedMeta)
  const [markdown, setMarkdown] = useState(savedMarkdown)

  // Sync local state when active concept changes (switch, delete)
  const prevActiveId = usePrevious(activeId)
  if (prevActiveId !== activeId) {
    setMeta(savedMeta)
    setMarkdown(savedMarkdown)
  }

  useAutoSave(activeId, meta, markdown)
  const { saveAutoSnapshot, saveManualSnapshot: _saveManualSnapshot } = useSnapshots(activeId, meta, markdown)
  // _saveManualSnapshot is wired to the toolbar in a follow-up task

  function handleMetaChange(patch: Partial<ConceptMeta>) {
    setMeta(prev => ({ ...prev, ...patch }))
  }

  // Snapshot outgoing concept *before* switching so refs still hold its content
  function handleSelect(id: ConceptId) {
    saveAutoSnapshot()
    selectConcept(id)
  }

  function handleDelete(id: ConceptId) {
    if (id === activeId) saveAutoSnapshot()
    deleteConcept(id)
  }

  return (
    <div className="editor-layout">
      <Sidebar
        concepts={concepts.map((c: { id: ConceptId; title: string | null }) => ({ id: c.id, title: c.title ?? '' }))}
        activeId={activeId}
        onSelect={id => handleSelect(id as ConceptId)}
        onNew={createConcept}
        onDelete={id => handleDelete(id as ConceptId)}
        onRestore={_id => { /* implemented in task 4 */ }}
      />
      <SourcePane
        meta={meta}
        markdown={markdown}
        onMetaChange={handleMetaChange}
        onMarkdownChange={setMarkdown}
      />
      <PreviewPane meta={meta} markdown={markdown} />
    </div>
  )
}

/** Returns the value from the previous render */
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  const prev = ref.current
  ref.current = value
  return prev
}
