import { useRef, useState } from 'react'
import type { ConceptMeta, SnapshotContent, Palette } from '../types'
import { useConcepts } from '../hooks/useConcepts'
import { useActiveConcept } from '../hooks/useActiveConcept'
import { useAutoSave } from '../hooks/useAutoSave'
import { useSnapshots } from '../hooks/useSnapshots'
import Sidebar from './Sidebar'
import SourcePane from './SourcePane'
import PreviewPane from './PreviewPane'
import type { ConceptId } from '../db/schema'

interface EditorLayoutProps {
  onSnapshotReady?: (saveFn: (label: string | null) => void) => void
}

export default function EditorLayout({ onSnapshotReady }: EditorLayoutProps) {
  const concepts = useConcepts()
  const {
    activeId,
    activeRow,
    meta: savedMeta,
    markdown: savedMarkdown,
    selectConcept,
    createConcept,
    deleteConcept,
  } = useActiveConcept(concepts)

  // Local form state for instant UI response — auto-saved to Evolu
  const [meta, setMeta] = useState<ConceptMeta>(savedMeta)
  const [markdown, setMarkdown] = useState(savedMarkdown)

  // Sync local state when the active concept changes.
  //
  // We use a ref (not usePrevious) to track which concept has been synced.
  // The guard `activeRow?.id === activeId` ensures we only sync once Evolu
  // has returned data for the *new* concept — preventing a race where
  // useQuery still holds stale data from the previous concept and we'd
  // overwrite local state (and then auto-save) with the wrong content.
  const lastSyncedIdRef = useRef<ConceptId | null>(null)
  if (lastSyncedIdRef.current !== activeId && activeRow?.id === activeId) {
    lastSyncedIdRef.current = activeId
    setMeta(savedMeta)
    setMarkdown(savedMarkdown)
  }

  useAutoSave(activeId, meta, markdown, lastSyncedIdRef.current === activeId)
  const { saveAutoSnapshot, saveManualSnapshot } = useSnapshots(activeId, meta, markdown)

  // Expose saveManualSnapshot to the parent (App → Toolbar) via callback ref
  const onSnapshotReadyRef = useRef(onSnapshotReady)
  onSnapshotReadyRef.current = onSnapshotReady
  // Call once when the function becomes available; App stores it in a ref
  if (onSnapshotReadyRef.current) onSnapshotReadyRef.current(saveManualSnapshot)

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

  function handleRestore(content: SnapshotContent) {
    // Save current state first so the restore itself is undoable
    saveManualSnapshot(null)

    const restoredMeta: ConceptMeta = {
      ...meta,                                          // keep current logo
      title:    content.title,
      org:      content.org,
      year:     content.year,
      web:      content.web,
      fontSize: content.fontSize,
      palette:  (content.palette as Palette | null) ?? 'color',
    }
    setMeta(restoredMeta)
    setMarkdown(content.markdown)
    // useAutoSave picks up the state change and persists within 500 ms
  }

  return (
    <div className="editor-layout">
      <Sidebar
        concepts={concepts.map((c: { id: ConceptId; title: string | null }) => ({ id: c.id, title: c.title ?? '' }))}
        activeId={activeId}
        onSelect={id => handleSelect(id as ConceptId)}
        onNew={createConcept}
        onDelete={id => handleDelete(id as ConceptId)}
        onRestore={handleRestore}
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

