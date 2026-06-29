import { Suspense, use, useState } from 'react'
import { Mnemonic, formatMnemonicError } from '@evolu/common'
import { useQuery } from '@evolu/react'
import { useEvolu, allConceptPublishIdsQuery, type ConceptLogoId } from '../db/schema'
import {
  loadPublishConfig,
  savePublishConfig,
  isConfigured,
  checkAccess,
  importFromRepo,
  type PublishConfig,
} from '../lib/githubPublish'
import { useToast } from './ToastProvider'
import { useConfirm } from './ConfirmProvider'

// ── Mnemonic display ──────────────────────────────────────
// Suspends until appOwner is available (OPFS/worker init).
function MnemonicPanel() {
  const evolu = useEvolu()
  const appOwner = use(evolu.appOwner)
  const mnemonic = appOwner.mnemonic ?? ''
  const words = mnemonic ? mnemonic.split(' ') : []
  const [copied, setCopied] = useState(false)

  if (words.length === 0) {
    return <p className="modal-hint">Fráze není dostupná.</p>
  }

  function handleCopy() {
    void navigator.clipboard.writeText(mnemonic).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <div className="mnemonic-words">
        {words.map((word, i) => (
          <span key={i} className="mnemonic-word">
            <span className="mnemonic-word-index">{i + 1}.</span>
            {word}
          </span>
        ))}
      </div>
      <button className="mnemonic-copy-btn" onClick={handleCopy}>
        {copied ? '✓ Zkopírováno' : 'Kopírovat frázi'}
      </button>
    </>
  )
}

// ── Publish settings + import ─────────────────────────────
// Repo/PAT config (stored per-device in localStorage) and the two-way recovery
// "Import from repo" action. Suspends on the publishId query (for import dedup).
function PublishSettings() {
  const { insert } = useEvolu()
  const existing = useQuery(allConceptPublishIdsQuery)
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const saved = loadPublishConfig()
  const [owner, setOwner] = useState(saved?.owner ?? '')
  const [repo, setRepo] = useState(saved?.repo ?? '')
  const [branch, setBranch] = useState(saved?.branch ?? 'main')
  const [token, setToken] = useState(saved?.token ?? '')
  const [busy, setBusy] = useState<null | 'test' | 'import'>(null)

  function currentConfig(): PublishConfig {
    return { owner: owner.trim(), repo: repo.trim(), branch: branch.trim() || 'main', token: token.trim() }
  }

  function handleSave() {
    savePublishConfig(currentConfig())
    showToast({ message: 'Nastavení publikování uloženo.' })
  }

  async function handleTest() {
    const cfg = currentConfig()
    if (!isConfigured(cfg)) { showToast({ message: 'Vyplňte vlastníka, repozitář i token.' }); return }
    setBusy('test')
    try {
      await checkAccess(cfg)
      savePublishConfig(cfg)
      showToast({ message: `Připojení k ${cfg.owner}/${cfg.repo} funguje.` })
    } catch (e) {
      showToast({ message: `Připojení selhalo: ${e instanceof Error ? e.message : String(e)}`, durationMs: 8000 })
    } finally {
      setBusy(null)
    }
  }

  async function handleImport() {
    const cfg = currentConfig()
    if (!isConfigured(cfg)) { showToast({ message: 'Nejdřív uložte přístup k repozitáři.' }); return }
    savePublishConfig(cfg)
    const ok = await confirm({
      title: 'Obnovit z repozitáře?',
      message: 'Načte publikované letáky a vytvoří ty, které v editoru chybí. Stávající letáky zůstanou beze změny.',
      confirmLabel: 'Obnovit',
      cancelLabel: 'Zrušit',
    })
    if (!ok) return

    setBusy('import')
    try {
      const flyers = await importFromRepo(cfg)
      const have = new Set(existing.map(c => c.publishId).filter(Boolean) as string[])
      let created = 0
      for (const f of flyers) {
        if (have.has(f.publishId)) continue
        let logoId: ConceptLogoId | null = null
        if (f.logoDataUrl) {
          const logoRes = insert('conceptLogo', { data: f.logoDataUrl })
          if (logoRes.ok) logoId = logoRes.value.id as ConceptLogoId
        }
        const res = insert('concept', {
          title: f.meta.title,
          org: f.meta.org,
          year: f.meta.year,
          web: f.meta.web,
          fontSize: f.meta.fontSize,
          logo: null,
          logoId,
          palette: f.meta.palette,
          markdown: f.markdown,
          publishId: f.publishId,
        })
        if (res.ok) created++
      }
      showToast({
        message: created
          ? `Obnoveno ${created} letáků z repozitáře.`
          : 'Vše už je v editoru — nic nového k obnovení.',
      })
    } catch (e) {
      showToast({ message: `Obnovení selhalo: ${e instanceof Error ? e.message : String(e)}`, durationMs: 8000 })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <p className="modal-section-label" style={{ marginTop: 20 }}>Publikování na GitHub</p>
      <p className="modal-hint">
        Hotové letáky se ukládají jako verzované Markdown soubory do zvoleného
        repozitáře. Token (jemně odstupňovaný PAT s právem <em>Contents</em> pro
        tento repozitář) zůstává jen v tomto prohlížeči.
      </p>
      <div className="settings-grid">
        <input className="settings-input" placeholder="vlastník (owner)" value={owner}
          onChange={e => setOwner(e.target.value)} />
        <input className="settings-input" placeholder="repozitář (repo)" value={repo}
          onChange={e => setRepo(e.target.value)} />
        <input className="settings-input" placeholder="větev" value={branch}
          onChange={e => setBranch(e.target.value)} />
        <input className="settings-input" type="password" placeholder="GitHub token (PAT)" value={token}
          onChange={e => setToken(e.target.value)} autoComplete="off" />
      </div>
      <div className="settings-actions">
        <button className="modal-close-btn" onClick={handleSave}>Uložit</button>
        <button className="modal-close-btn" onClick={handleTest} disabled={busy !== null}>
          {busy === 'test' ? 'Ověřuji…' : 'Ověřit připojení'}
        </button>
        <button className="modal-restore-btn" onClick={handleImport} disabled={busy !== null}>
          {busy === 'import' ? 'Obnovuji…' : 'Obnovit z repozitáře'}
        </button>
      </div>
    </>
  )
}

// ── Modal ─────────────────────────────────────────────────
interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const evolu = useEvolu()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  function handleRestore(e: React.FormEvent) {
    e.preventDefault()
    const result = Mnemonic.from(input.trim())
    if (!result.ok) {
      // formatMnemonicError only handles MnemonicError; for upstream errors
      // (empty string, whitespace) show a plain message instead.
      const msg = result.error.type === 'Mnemonic'
        ? formatMnemonicError(result.error)
        : 'Zadejte platnou zálohovací frázi (12 slov oddělených mezerou).'
      setError(msg)
      return
    }
    setRestoring(true)
    // restoreAppOwner reloads the page — no need to handle the returned promise
    void evolu.restoreAppOwner(result.value)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Synchronizace</div>

        {/* ── Mnemonic display ── */}
        <p className="modal-section-label">Zálohovací fráze</p>
        <p className="modal-hint">
          Zapište si tato slova. Slouží k obnovení dat na novém zařízení.
        </p>
        <Suspense fallback={<p className="modal-hint">Načítání…</p>}>
          <MnemonicPanel />
        </Suspense>

        {/* ── Restore form ── */}
        <p className="modal-section-label" style={{ marginTop: 20 }}>
          Obnovit z jiného zařízení
        </p>
        <p className="modal-hint">
          Vložte zálohovací frázi z jiného zařízení. Lokální data budou
          nahrazena.{' '}
          <strong>Tuto akci nelze vrátit.</strong>
        </p>
        <form onSubmit={handleRestore}>
          <textarea
            className="mnemonic-input"
            placeholder="Zadejte 12 slov zálohovací fráze…"
            value={input}
            rows={3}
            onChange={e => {
              setInput(e.target.value)
              setError(null)
            }}
          />
          {error && <p className="mnemonic-error">{error}</p>}
          <button
            type="submit"
            className="modal-restore-btn"
            disabled={!input.trim() || restoring}
          >
            {restoring ? 'Obnovuji…' : 'Obnovit a restartovat'}
          </button>
        </form>

        {/* ── Publish / recovery ── */}
        <Suspense fallback={<p className="modal-hint">Načítání…</p>}>
          <PublishSettings />
        </Suspense>

        <div className="modal-footer">
          <button className="modal-close-btn" onClick={onClose}>
            Zavřít
          </button>
        </div>
      </div>
    </div>
  )
}
