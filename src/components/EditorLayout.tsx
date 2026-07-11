import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConceptMeta, SnapshotContent, Palette, Proposal, Decision } from '../types'
import { writeEditorCache } from '../lib/editorCache'
import { useConcepts } from '../hooks/useConcepts'
import { useActiveConcept } from '../hooks/useActiveConcept'
import { useIdentity } from '../hooks/useIdentity'
import { useAutoSave } from '../hooks/useAutoSave'
import { useSnapshots } from '../hooks/useSnapshots'
import { useAiBridge } from '../hooks/useAiBridge'
import { getAutoAcceptEdits } from '../lib/aiBridge'
import { captureFlyerPng } from '../lib/flyerScreenshot'
import { loadPublishConfig, isConfigured, newPublishId, publishConcept } from '../lib/githubPublish'
import { slugify } from '../lib/slug'
import { releaseFingerprint } from '../lib/releaseFingerprint'
import { useEvolu } from '../db/schema'
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
  onPublishReady?: (publishFn: () => void) => void
  onPublishingChange?: (v: boolean) => void
}

/**
 * Serialize the editable content of a concept for change detection. Covers
 * exactly the columns useAutoSave writes — row-only fields (reviewStatus,
 * publishId) and the auto-derived org/year/web are excluded so they never
 * trigger a spurious adoption.
 */
function contentKey(meta: ConceptMeta, markdown: string): string {
  return JSON.stringify([
    meta.title, meta.fontSize,
    meta.logo, meta.logoId, meta.palette, markdown,
  ])
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

type SidebarRelease = 'none' | 'clean' | 'drifted'

/**
 * Local, network-free release state for a sidebar row. Compares a fresh
 * fingerprint of the row's editable content against the baseline stored at
 * last publish. A published row with no baseline (older publish, or a wiped DB
 * not yet reimported) reads as "drifted" — the safe default: it nudges a
 * re-publish instead of hiding a possible change.
 */
function releaseFor(c: {
  publishId: string | null
  lastPublishedHash: string | null
  lastPublishedAt: string | null
  lastPublishedVersion: number | null
  title: string | null
  fontSize: number
  palette: string | null
  logoId: string | null
  markdown: string
}): { state: SidebarRelease; title?: string } {
  if (c.publishId == null) return { state: 'none' }
  const fp = releaseFingerprint({
    title: c.title ?? '', fontSize: c.fontSize, palette: c.palette,
    logoId: c.logoId, markdown: c.markdown,
  })
  const drifted = c.lastPublishedHash == null || fp !== c.lastPublishedHash
  const v = c.lastPublishedVersion != null ? `v${c.lastPublishedVersion}` : 'publikováno'
  const when = c.lastPublishedAt
    ? new Date(String(c.lastPublishedAt)).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
    : ''
  const title = `Publikováno ${v}${when ? ` · ${when}` : ''}${drifted ? ' · změněno od publikace' : ''}`
  return { state: drifted ? 'drifted' : 'clean', title }
}

export default function EditorLayout({ onSnapshotReady, onPublishReady, onPublishingChange }: EditorLayoutProps) {
  const concepts = useConcepts()
  const { update } = useEvolu()
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
  // `agreedKey` is the last content on which local state and the DB row agreed
  // — set on adoption and whenever our own auto-save echoes back. It lets us
  // tell a remote sync change (row moved away from the agreement) apart from
  // the echo of our own write (row caught up to local). State, not a ref, for
  // the same Strict Mode reason as `syncedId` above.
  const [agreedKey, setAgreedKey] = useState<string | null>(null)
  if (syncedId !== activeId && activeRow?.id === activeId) {
    setSyncedId(activeId)
    setMeta(savedMeta)
    setMarkdown(savedMarkdown)
    setAgreedKey(contentKey(savedMeta, savedMarkdown))
  }

  // Adopt remote changes to the OPEN concept (other device via relay, or a
  // second tab). Without this the editor only reads the row on concept switch,
  // so synced edits stay invisible until a reload — "sync looks broken".
  if (syncedId === activeId && activeRow?.id === activeId) {
    const rowKey = contentKey(savedMeta, savedMarkdown)
    if (rowKey !== agreedKey) {
      const localKey = contentKey(meta, markdown)
      if (localKey === rowKey) {
        // Our own auto-save echoed back — record the new agreement.
        setAgreedKey(rowKey)
      } else if (localKey === agreedKey) {
        // Local state is clean since the last agreement → genuine remote
        // change → adopt it.
        setAgreedKey(rowKey)
        setMeta(savedMeta)
        setMarkdown(savedMarkdown)
      }
      // Both diverged: the user is mid-edit; their pending auto-save wins
      // (column-level last-write-wins), so leave local state alone.
    }
  }

  useAutoSave(activeId, meta, markdown, syncedId === activeId)

  // Auto-derived flyer fields: org/web come from the shared identity setting
  // (Nastavení), falling back to the legacy per-concept columns for concepts
  // created before the setting existed; year is the year of the last edit
  // (updatedAt is a system column Evolu bumps on every row change). Everything
  // that *renders or captures* the flyer uses effectiveMeta; only the truly
  // editable fields live in `meta` state and get auto-saved.
  const identity = useIdentity()
  const rowStamp = activeRow?.updatedAt ?? activeRow?.createdAt ?? null
  const autoYear = String(
    (rowStamp ? new Date(String(rowStamp)) : new Date()).getFullYear(),
  )
  const effectiveMeta = useMemo<ConceptMeta>(() => ({
    ...meta,
    org: identity.org ?? meta.org,
    web: identity.web ?? meta.web,
    year: autoYear,
  }), [meta, identity.org, identity.web, autoYear])

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
      meta: effectiveMeta,
      markdown,
    })
  }, [activeId, concepts, effectiveMeta, markdown, syncedId])

  // Snapshots capture effectiveMeta so history renders the flyer as it truly
  // looked — including the auto org/web/year of that moment.
  const { saveAutoSnapshot, saveManualSnapshot } = useSnapshots(activeId, effectiveMeta, markdown)

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

  // buffer=true keeps a decision for the next await_decision call (the normal
  // gated flow). Auto-accept passes buffer=false: it resolves a waiter if one
  // is already blocked, but never buffers — no review happened, so a later
  // await_decision must not pick up a stale "accepted".
  function settleDecision(d: Decision, buffer = true) {
    if (decisionWaiterRef.current) {
      const resolve = decisionWaiterRef.current
      decisionWaiterRef.current = null
      resolve(d)
    } else if (buffer) {
      bufferedDecisionRef.current = d
    }
  }

  useAiBridge({
    get_state: () => {
      const facts = readPreviewFacts()
      return {
        meta: {
          title: effectiveMeta.title,
          org: effectiveMeta.org,
          year: effectiveMeta.year,
          web: effectiveMeta.web,
          fontSize: effectiveMeta.fontSize,
          palette: effectiveMeta.palette,
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
      // org/year/web are auto-derived now (identity setting + last-edit date);
      // proposals for them are ignored so an accepted edit can't clobber them.
      const known = ['markdown', 'title', 'fontSize', 'palette']
      if (!known.some(k => k in args)) {
        throw new Error(
          'Nebyla zadána žádná změna. (org/web se nastavují v Nastavení a rok je automatický — navrhnout lze markdown, title, fontSize a palette.)',
        )
      }
      const nextMeta: ConceptMeta = { ...effectiveMeta }
      if ('title' in args) nextMeta.title = String(args.title ?? '')
      if ('fontSize' in args) {
        const n = Number(args.fontSize)
        if (!Number.isNaN(n)) nextMeta.fontSize = n
      }
      if ('palette' in args) nextMeta.palette = args.palette === 'bw' ? 'bw' : 'color'
      const nextMarkdown = 'markdown' in args ? String(args.markdown ?? '') : markdown
      // Trust mode: apply edits straight away (still snapshotted + undoable).
      // Only `edit` is auto-accepted; switch/create/delete always stay gated.
      if (getAutoAcceptEdits()) {
        applyEditTarget(nextMeta, nextMarkdown, true)
        settleDecision({ accepted: true }, false)
        return 'auto-accepted'
      }
      setPendingProposal({ kind: 'edit', target: { meta: nextMeta, markdown: nextMarkdown } })
      return 'staged'
    },
    create_concept: (args: Record<string, unknown>) => {
      // Build a fresh blank concept, then layer on whatever the AI specified.
      // Unspecified fields stay blank (year = current, fontSize 9.5, color).
      const nextMeta: ConceptMeta = {
        title: '', org: '', year: String(new Date().getFullYear()),
        web: '', fontSize: 9.5, logo: '', logoId: null, palette: 'color',
      }
      if ('title' in args) nextMeta.title = String(args.title ?? '')
      if ('org' in args) nextMeta.org = String(args.org ?? '')
      if ('year' in args) nextMeta.year = String(args.year ?? '')
      if ('web' in args) nextMeta.web = String(args.web ?? '')
      if ('fontSize' in args) {
        const n = Number(args.fontSize)
        if (!Number.isNaN(n)) nextMeta.fontSize = n
      }
      if ('palette' in args) nextMeta.palette = args.palette === 'bw' ? 'bw' : 'color'
      const nextMarkdown = 'markdown' in args ? String(args.markdown ?? '') : ''
      setPendingProposal({ kind: 'create', target: { meta: nextMeta, markdown: nextMarkdown } })
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

  const onPublishReadyRef = useRef(onPublishReady)
  onPublishReadyRef.current = onPublishReady
  if (onPublishReadyRef.current) onPublishReadyRef.current(handlePublish)

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

  // Flag/unflag a concept "for review" — an editorial state, kept out of the
  // printed flyer. Persists straight to the row (no snapshot; it's metadata).
  function handleToggleReview(id: ConceptId, current: string | null) {
    update('concept', { id, reviewStatus: current === 'review' ? null : 'review' })
  }

  // Apply an edit target through the single-writer path: snapshot first, swap
  // state, offer Undo. Shared by manual Accept and auto-accept (trust mode), so
  // both are identical writes — just a snapshot + restore, fully undoable.
  function applyEditTarget(targetMeta: ConceptMeta, targetMarkdown: string, auto: boolean) {
    saveManualSnapshot(auto ? 'Před úpravou od AI (auto)' : 'Před úpravou od AI')
    const prevMeta = { ...meta }
    const prevMarkdown = markdown
    setMeta(targetMeta)
    setMarkdown(targetMarkdown)
    showToast({
      message: auto ? 'Úprava od AI přijata automaticky.' : 'Úprava od AI použita.',
      action: {
        label: 'Zpět',
        onClick: () => { setMeta(prevMeta); setMarkdown(prevMarkdown) },
      },
    })
  }

  // Accept an AI proposal — the SAME single-writer path as handleRestore, so it
  // snapshots first and is fully undoable.
  function acceptProposal() {
    const p = proposalRef.current
    if (!p) return
    if (p.kind === 'edit') {
      applyEditTarget(p.target.meta, p.target.markdown, false)
      setPendingProposal(null)
      settleDecision({ accepted: true })
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
    } else if (p.kind === 'create') {
      // Snapshot the outgoing concept first (mirrors handleSelect), then create
      // the new one populated with the proposed content and switch to it.
      const prevId = activeId
      saveAutoSnapshot()
      const newId = createConcept({
        title:    p.target.meta.title,
        org:      p.target.meta.org,
        year:     p.target.meta.year,
        web:      p.target.meta.web,
        fontSize: p.target.meta.fontSize,
        palette:  p.target.meta.palette,
        markdown: p.target.markdown,
      })
      setPendingProposal(null)
      settleDecision({ accepted: true })
      showToast({
        message: 'Nový leták vytvořen.',
        // Undo = drop the new concept and go back to where we were.
        action: {
          label: 'Zpět',
          onClick: () => {
            if (prevId) selectConcept(prevId)
            if (newId) deleteConcept(newId)
          },
        },
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

    // org/year/web are NOT restored: org/web live in the identity setting and
    // year derives from the last-edit date — a restore shouldn't clobber them.
    const restoredMeta: ConceptMeta = {
      ...meta,
      title:    content.title,
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

  // Publish the active concept as a new versioned Markdown file in the archive
  // repo. Generates a stable publishId on first publish and persists it to the
  // concept row so future publishes append to the same version lineage.
  async function handlePublish() {
    const cfg = loadPublishConfig()
    if (!isConfigured(cfg)) {
      showToast({ message: 'Nejdřív nastavte GitHub repozitář v Nastavení.' })
      return
    }
    if (!activeId) return

    const ok = await confirm({
      title: 'Publikovat leták?',
      message: `Uloží novou verzi do ${cfg.owner}/${cfg.repo}.`,
      confirmLabel: 'Publikovat',
      cancelLabel: 'Zrušit',
    })
    if (!ok) return

    let publishId = (activeRow?.publishId as string | null) ?? null
    if (!publishId) {
      publishId = newPublishId()
      update('concept', { id: activeId, publishId })
    }

    onPublishingChange?.(true)
    try {
      const slug = slugify(effectiveMeta.title, publishId)
      const knownSlug = (activeRow?.lastPublishedSlug as string | null) ?? null
      const res = await publishConcept(cfg, { publishId, slug, knownSlug, meta: effectiveMeta, markdown })
      // Persist the release baseline for the sidebar drift badge. Fingerprint
      // the editable content (not effectiveMeta) so it matches what the sidebar
      // recomputes per row. lastPublishedSlug is the O(1) locate hint next time.
      update('concept', {
        id: activeId,
        lastPublishedHash: releaseFingerprint({
          title: meta.title, fontSize: meta.fontSize, palette: meta.palette,
          logoId: meta.logoId, markdown,
        }),
        lastPublishedAt: new Date().toISOString(),
        lastPublishedSlug: res.slug,
        lastPublishedVersion: res.version,
      })
      showToast({
        message: `Publikováno jako v${res.version}.`,
        action: { label: 'Otevřít', onClick: () => window.open(res.url, '_blank', 'noopener') },
      })
    } catch (e) {
      showToast({
        message: `Publikování selhalo: ${e instanceof Error ? e.message : String(e)}`,
        durationMs: 8000,
      })
    } finally {
      onPublishingChange?.(false)
    }
  }

  return (
    <div className="editor-layout">
      <Sidebar
        concepts={concepts.map(c => {
          const release = releaseFor({
            publishId: c.publishId,
            lastPublishedHash: c.lastPublishedHash,
            lastPublishedAt: c.lastPublishedAt,
            lastPublishedVersion: c.lastPublishedVersion,
            title: c.title,
            fontSize: c.fontSize ?? 9.5,
            palette: c.palette,
            logoId: c.logoId as string | null,
            markdown: c.markdown ?? '',
          })
          return {
            id: c.id, title: c.title ?? '', reviewStatus: c.reviewStatus,
            releaseState: release.state, releaseTitle: release.title,
          }
        })}
        activeId={activeId}
        onSelect={id => handleSelect(id as ConceptId)}
        onNew={() => createConcept()}
        onDelete={id => handleDelete(id as ConceptId)}
        onToggleReview={(id, current) => handleToggleReview(id as ConceptId, current)}
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
      <PreviewPane
        meta={effectiveMeta}
        markdown={markdown}
        onTitleChange={title => handleMetaChange({ title })}
      />
      {pendingProposal && (
        <ProposalReview
          proposal={pendingProposal}
          currentMeta={effectiveMeta}
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
