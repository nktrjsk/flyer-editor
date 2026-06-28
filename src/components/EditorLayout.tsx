import { useEffect, useRef, useState } from 'react'
import type { ConceptMeta, SnapshotContent, Palette, Proposal, Decision } from '../types'
import { writeEditorCache } from '../lib/editorCache'
import { useConcepts } from '../hooks/useConcepts'
import { useActiveConcept } from '../hooks/useActiveConcept'
import { useAutoSave } from '../hooks/useAutoSave'
import { useSnapshots } from '../hooks/useSnapshots'
import { useAiBridge } from '../hooks/useAiBridge'
import { captureFlyerPng } from '../lib/flyerScreenshot'
import { useToast } from './ToastProvider'
import { useConfirm } from './ConfirmProvider'
import Sidebar from './Sidebar'
import SourcePane from './SourcePane'
import PreviewPane from './PreviewPane'
import HistoryExplorer from './HistoryExplorer'
import ProposalReview from './ProposalReview'
import type { ConceptId } from '../db/schema'

interface EditorLayoutProps {
  onSnapshotReady?: (saveFn: (label: string | null) => void) => void
}

/**
 * Read the live render facts straight from the preview DOM — the same signals
 * the overflow bar and title auto-fit already compute, surfaced for `get_state`.
 */
function readPreviewFacts() {
  const pane = document.getElementById('preview')
  if (!pane) return { pages: 0, overflow: false, overflowingPages: [] as number[], titleFitPt: [] as number[] }
  const pageEls = Array.from(pane.querySelectorAll<HTMLElement>('.page'))
  const overflowingPages: number[] = []
  pageEls.forEach((p, i) => { if (p.classList.contains('is-overflowing')) overflowingPages.push(i) })
  const titleFitPt: number[] = []
  pane.querySelectorAll<HTMLElement>('.page-title').forEach(el => {
    const pt = parseFloat(el.style.fontSize)
    if (!Number.isNaN(pt)) titleFitPt.push(pt)
  })
  return { pages: pageEls.length, overflow: overflowingPages.length > 0, overflowingPages, titleFitPt }
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

  const conceptList = concepts.map((c: { id: ConceptId; title: string | null }) => ({
    id: c.id as string,
    title: c.title ?? '',
  }))

  // --- AI proposal gate ----------------------------------------------------
  // Every AI write is a staged proposal; one slot at a time (newer replaces an
  // un-decided one). Accept routes through the SAME single-writer path as a
  // restore, so AI edits are fully undoable and can't corrupt state.
  const [pendingProposal, setPendingProposal] = useState<Proposal | null>(null)
  const proposalRef = useRef<Proposal | null>(null)
  proposalRef.current = pendingProposal

  // await_decision coordination: a waiter resolves on the user's click; a
  // decision made before await_decision is called is buffered for the next call.
  const decisionWaiterRef = useRef<((d: Decision) => void) | null>(null)
  const bufferedDecisionRef = useRef<Decision | null>(null)

  function settleDecision(d: Decision) {
    if (decisionWaiterRef.current) {
      const resolve = decisionWaiterRef.current
      decisionWaiterRef.current = null
      resolve(d)
    } else {
      bufferedDecisionRef.current = d
    }
  }

  useAiBridge({
    get_state: () => {
      const facts = readPreviewFacts()
      return {
        meta: {
          title: meta.title,
          org: meta.org,
          year: meta.year,
          web: meta.web,
          fontSize: meta.fontSize,
          palette: meta.palette,
        },
        markdown,
        pages: facts.pages,
        overflow: facts.overflow,
        overflowingPages: facts.overflowingPages,
        titleFitPt: facts.titleFitPt,
        palette: meta.palette,
        hasLogo: !!meta.logo,
      }
    },
    list_concepts: () => conceptList,
    get_screenshot: () => captureFlyerPng(),
    propose_changes: (args: Record<string, unknown>) => {
      const known = ['markdown', 'title', 'org', 'year', 'web', 'fontSize', 'palette']
      if (!known.some(k => k in args)) throw new Error('Nebyla zadána žádná změna.')
      const nextMeta: ConceptMeta = { ...meta }
      if ('title' in args) nextMeta.title = String(args.title ?? '')
      if ('org' in args) nextMeta.org = String(args.org ?? '')
      if ('year' in args) nextMeta.year = String(args.year ?? '')
      if ('web' in args) nextMeta.web = String(args.web ?? '')
      if ('fontSize' in args) {
        const n = Number(args.fontSize)
        if (!Number.isNaN(n)) nextMeta.fontSize = n
      }
      if ('palette' in args) nextMeta.palette = args.palette === 'bw' ? 'bw' : 'color'
      const nextMarkdown = 'markdown' in args ? String(args.markdown ?? '') : markdown
      setPendingProposal({ kind: 'edit', target: { meta: nextMeta, markdown: nextMarkdown } })
      return 'staged'
    },
    switch_concept: (args: Record<string, unknown>) => {
      const id = String(args.id ?? '')
      if (!id) throw new Error('Chybí id konceptu.')
      const target = conceptList.find(c => c.id === id)
      if (!target) throw new Error('Koncept s tímto id neexistuje. Použij list_concepts.')
      if (id === activeId) throw new Error('Tento leták je už otevřený.')
      setPendingProposal({ kind: 'switch', toId: id, toTitle: target.title })
      return 'staged'
    },
    await_decision: () => {
      // A decision already made (before this call) is delivered immediately.
      if (bufferedDecisionRef.current) {
        const d = bufferedDecisionRef.current
        bufferedDecisionRef.current = null
        return d
      }
      return new Promise<Decision>(resolve => {
        decisionWaiterRef.current = resolve
        // ~5 min cap → tell Claude it's still pending so it can poll again.
        setTimeout(() => {
          if (decisionWaiterRef.current === resolve) {
            decisionWaiterRef.current = null
            resolve({ status: 'pending' })
          }
        }, 45_000) // cap under the MCP client's ~60s request timeout; Claude re-calls
      })
    },
  })

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

  // Accept an AI proposal — the SAME single-writer path as handleRestore, so it
  // snapshots first and is fully undoable.
  function acceptProposal() {
    const p = proposalRef.current
    if (!p) return
    if (p.kind === 'edit') {
      saveManualSnapshot('Před úpravou od AI')
      const prevMeta = { ...meta }
      const prevMarkdown = markdown
      setMeta(p.target.meta)
      setMarkdown(p.target.markdown)
      setPendingProposal(null)
      settleDecision({ accepted: true })
      showToast({
        message: 'Úprava od AI použita.',
        action: {
          label: 'Zpět',
          onClick: () => { setMeta(prevMeta); setMarkdown(prevMarkdown) },
        },
      })
    } else if (p.kind === 'switch') {
      // Snapshot the outgoing concept first, then switch — mirrors handleSelect.
      const prevId = activeId
      saveAutoSnapshot()
      selectConcept(p.toId as ConceptId)
      setPendingProposal(null)
      settleDecision({ accepted: true })
      showToast({
        message: 'Přepnuto na jiný leták.',
        ...(prevId ? { action: { label: 'Zpět', onClick: () => selectConcept(prevId) } } : {}),
      })
    }
  }

  function rejectProposal(reason?: string) {
    setPendingProposal(null)
    settleDecision({ accepted: false, reason })
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
      {pendingProposal && (
        <ProposalReview
          proposal={pendingProposal}
          currentMeta={meta}
          currentMarkdown={markdown}
          onAccept={acceptProposal}
          onReject={rejectProposal}
        />
      )}
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
