import { useEffect, useRef, useState } from 'react'
import type { ConceptMeta, SnapshotContent, Palette } from '../types'
import { writeEditorCache } from '../lib/editorCache'
import { useConcepts } from '../hooks/useConcepts'
import { useActiveConcept } from '../hooks/useActiveConcept'
import { useAutoSave } from '../hooks/useAutoSave'
import { useSnapshots } from '../hooks/useSnapshots'
import { useToast } from './ToastProvider'
import { useConfirm } from './ConfirmProvider'
import Sidebar from './Sidebar'
import SourcePane from './SourcePane'
import PreviewPane from './PreviewPane'
import HistoryExplorer from './HistoryExplorer'
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
    createLogo,
  } = useActiveConcept(concepts)

  // Local form state for instant UI response — auto-saved to Evolu
  const [meta, setMeta] = useState<ConceptMeta>(savedMeta)
  const [markdown, setMarkdown] = useState(savedMarkdown)

  // Sync local state when the active concept changes.
  //
  // `syncedId` (state, not a ref) tracks which concept's data is currently
  // reflected in `meta`/`markdown`. Using state — not a ref — is critical:
  // a ref mutated in the first Strict Mode render invocation persists into
  // the second, causing isSynced to flip true while meta still holds the
  // previous concept's content. State is the same in both invocations and
  // only updates after all setMeta/setMarkdown calls have been applied.
  //
  // The guard `activeRow?.id === activeId` prevents syncing from stale Evolu
  // data returned before the query has caught up to the new concept.
  const [syncedId, setSyncedId] = useState<ConceptId | null>(null)
  if (syncedId !== activeId && activeRow?.id === activeId) {
    setSyncedId(activeId)
    setMeta(savedMeta)
    setMarkdown(savedMarkdown)
  }

  useAutoSave(activeId, meta, markdown, syncedId === activeId)

  // Persist the visible editor state so the next load can paint a populated
  // placeholder instead of an empty editor. Only cache once local state is
  // synced to the active concept, so we never store a stale/mismatched flyer.
  useEffect(() => {
    if (syncedId !== activeId) return
    writeEditorCache({
      activeId,
      concepts: concepts.map((c: { id: ConceptId; title: string | null }) => ({
        id: c.id,
        title: c.title ?? '',
      })),
      meta,
      markdown,
    })
  }, [activeId, concepts, meta, markdown, syncedId])

  const { saveAutoSnapshot, saveManualSnapshot } = useSnapshots(activeId, meta, markdown)

  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const [historyExplorerOpen, setHistoryExplorerOpen] = useState(false)

  // Expose saveManualSnapshot to the parent (App → Toolbar) via callback ref
  const onSnapshotReadyRef = useRef(onSnapshotReady)
  onSnapshotReadyRef.current = onSnapshotReady
  // Call once when the function becomes available; App stores it in a ref
  if (onSnapshotReadyRef.current) onSnapshotReadyRef.current(saveManualSnapshot)

  function handleMetaChange(patch: Partial<ConceptMeta>) {
    setMeta(prev => ({ ...prev, ...patch }))
  }

  function handleLogoChange(data: string) {
    if (!data) {
      setMeta(prev => ({ ...prev, logo: '', logoId: null }))
      return
    }
    const logoId = createLogo(data)
    setMeta(prev => ({ ...prev, logo: data, logoId: logoId ?? null }))
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

  async function handleRestore(content: SnapshotContent) {
    // Save current state first so the restore itself is undoable
    saveManualSnapshot('Před obnovením')

    // Store previous state for undo
    const prevMeta = { ...meta }
    const prevMarkdown = markdown

    const ok = await confirm({
      title: 'Obnovit verzi?',
      message: 'Aktuální stav byl automaticky zazálohován. Přejete si obnovit vybranou verzi?',
      confirmLabel: 'Obnovit',
      cancelLabel: 'Zrušit',
    })

    if (!ok) return

    const restoredMeta: ConceptMeta = {
      ...meta,
      title:    content.title,
      org:      content.org,
      year:     content.year,
      web:      content.web,
      fontSize: content.fontSize,
      palette:  (content.palette as Palette | null) ?? 'color',
      // Only restore logo if the snapshot has one; old snapshots (logoId=null)
      // preserve the current logo to avoid surprise data loss.
      ...(content.logoId !== null
        ? { logo: content.logo, logoId: content.logoId }
        : {}),
    }
    setMeta(restoredMeta)
    setMarkdown(content.markdown)

    showToast({
      message: 'Verze obnovena.',
      action: {
        label: 'Zpět',
        onClick: () => {
          setMeta(prevMeta)
          setMarkdown(prevMarkdown)
        },
      },
    })
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
        onBrowse={() => setHistoryExplorerOpen(true)}
      />
      <SourcePane
        meta={meta}
        markdown={markdown}
        onMetaChange={handleMetaChange}
        onLogoChange={handleLogoChange}
        onMarkdownChange={setMarkdown}
      />
      <PreviewPane meta={meta} markdown={markdown} />
      {historyExplorerOpen && (
        <HistoryExplorer
          activeId={activeId}
          onRestore={handleRestore}
          onClose={() => setHistoryExplorerOpen(false)}
        />
      )}
    </div>
  )
}
