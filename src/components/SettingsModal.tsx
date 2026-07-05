import { Suspense, use, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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
import {
  defaultRelayUrl,
  isValidRelayUrl,
  loadRelayUrl,
  saveRelayUrl,
} from '../lib/relayConfig'
import { useIdentity } from '../hooks/useIdentity'
import { useOrganizations, type Organization } from '../hooks/useOrganizations'
import type { OrganizationId } from '../db/schema'

// ── Flyer identity ────────────────────────────────────────
// Organization + web printed on every flyer. Synced via Evolu (one shared
// row), so setting it once covers all devices. Suspends on the query.
function IdentitySettings() {
  const identity = useIdentity()
  const { showToast } = useToast()
  const [org, setOrg] = useState(identity.org ?? '')
  const [web, setWeb] = useState(identity.web ?? '')

  const dirty = org.trim() !== (identity.org ?? '') || web.trim() !== (identity.web ?? '')

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    identity.save(org.trim(), web.trim())
    showToast({ message: 'Údaje na letáku uloženy.' })
  }

  return (
    <>
      <p className="modal-section-label">Výchozí údaje na letáku</p>
      <p className="modal-hint">
        Použijí se u letáků, které nejsou zařazené do žádného prostoru.
        Organizace a web se tisknou na letáku; rok se doplňuje automaticky
        podle poslední úpravy.
      </p>
      <form onSubmit={handleSave}>
        <div className="settings-grid">
          <input
            className="settings-input"
            placeholder="organizace"
            value={org}
            onChange={e => setOrg(e.target.value)}
          />
          <input
            className="settings-input"
            placeholder="web (example.cz)"
            value={web}
            onChange={e => setWeb(e.target.value)}
          />
        </div>
        <div className="settings-actions">
          <button type="submit" className="modal-restore-btn" disabled={!dirty}>
            Uložit
          </button>
        </div>
      </form>
    </>
  )
}

// ── Workspaces / organizations ────────────────────────────
// Each workspace carries its own printed identity (name + web). A concept
// assigned to one is stamped with that org instead of the default identity
// above. Managed here; switched in the sidebar.
function OrgRow({ org, onSave, onDelete }: {
  org: Organization
  onSave: (patch: { name: string; web: string }) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(org.name)
  const [web, setWeb] = useState(org.web)
  const { confirm } = useConfirm()

  const dirty = name.trim() !== org.name || web.trim() !== org.web
  const canSave = dirty && name.trim().length > 0

  async function handleDelete() {
    const ok = await confirm({
      title: 'Smazat prostor?',
      message: `Prostor „${org.name}" bude odstraněn. Letáky v něm zůstanou zachovány a přejdou na výchozí údaje.`,
      confirmLabel: 'Smazat',
      cancelLabel: 'Zrušit',
    })
    if (ok) onDelete()
  }

  return (
    <div className="org-row">
      <input
        className="settings-input"
        placeholder="název prostoru"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        className="settings-input"
        placeholder="web (example.cz)"
        value={web}
        onChange={e => setWeb(e.target.value)}
      />
      <button
        className="org-row-save"
        disabled={!canSave}
        onClick={() => onSave({ name: name.trim(), web: web.trim() })}
        title="Uložit změny"
      >
        Uložit
      </button>
      <button className="org-row-delete" onClick={handleDelete} title="Smazat prostor">✕</button>
    </div>
  )
}

function OrganizationsSettings() {
  const { organizations, createOrg, updateOrg, deleteOrg } = useOrganizations()
  const { showToast } = useToast()
  const [newName, setNewName] = useState('')
  const [newWeb, setNewWeb] = useState('')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    createOrg(name, newWeb.trim())
    setNewName('')
    setNewWeb('')
    showToast({ message: `Prostor „${name}" vytvořen.` })
  }

  return (
    <>
      <p className="modal-section-label" style={{ marginTop: 20 }}>Prostory (organizace)</p>
      <p className="modal-hint">
        Rozdělte letáky podle organizace. Každý prostor má vlastní název a web,
        které se tisknou na letácích v něm. Přepínat je můžete v levém panelu.
      </p>

      {organizations.length > 0 && (
        <div className="org-list">
          {organizations.map(o => (
            <OrgRow
              key={o.id}
              org={o}
              onSave={patch => {
                updateOrg(o.id as OrganizationId, patch)
                showToast({ message: 'Prostor uložen.' })
              }}
              onDelete={() => {
                deleteOrg(o.id as OrganizationId)
                showToast({ message: `Prostor „${o.name}" smazán.` })
              }}
            />
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="org-add">
        <div className="settings-grid">
          <input
            className="settings-input"
            placeholder="název nového prostoru"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            className="settings-input"
            placeholder="web (example.cz)"
            value={newWeb}
            onChange={e => setNewWeb(e.target.value)}
          />
        </div>
        <div className="settings-actions">
          <button type="submit" className="modal-close-btn" disabled={!newName.trim()}>
            Přidat prostor
          </button>
        </div>
      </form>
    </>
  )
}

// ── Mnemonic display ──────────────────────────────────────
// Suspends until appOwner is available (OPFS/worker init).
// Hidden by default: the words never reach the DOM until revealed, so an
// open Settings modal is safe on a shared screen. Copy works while hidden.
function MnemonicPanel() {
  const evolu = useEvolu()
  const appOwner = use(evolu.appOwner)
  const mnemonic = appOwner.mnemonic ?? ''
  const words = mnemonic ? mnemonic.split(' ') : []
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)

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
      {revealed ? (
        <div className="mnemonic-words">
          {words.map((word, i) => (
            <span key={i} className="mnemonic-word">
              <span className="mnemonic-word-index">{i + 1}.</span>
              {word}
            </span>
          ))}
        </div>
      ) : (
        // Fixed-width masks — real word lengths never render.
        <div className="mnemonic-words mnemonic-words--hidden" aria-hidden="true">
          {words.map((_, i) => (
            <span key={i} className="mnemonic-word">
              <span className="mnemonic-word-index">{i + 1}.</span>
              •••••
            </span>
          ))}
        </div>
      )}
      <div className="mnemonic-actions">
        <button
          className="mnemonic-copy-btn"
          onClick={() => setRevealed(r => !r)}
          aria-pressed={revealed}
        >
          {revealed
            ? <><EyeOff size={13} strokeWidth={1.8} aria-hidden="true" />Skrýt</>
            : <><Eye size={13} strokeWidth={1.8} aria-hidden="true" />Zobrazit frázi</>}
        </button>
        <button className="mnemonic-copy-btn" onClick={handleCopy}>
          {copied ? '✓ Zkopírováno' : 'Kopírovat frázi'}
        </button>
      </div>
    </>
  )
}

// ── Relay selection ───────────────────────────────────────
// Evolu reads transports once at boot, so saving reloads the page. Device-
// local (like the PAT): every device that should sync together must use the
// same relay.
function RelaySettings() {
  const [url, setUrl] = useState(loadRelayUrl())
  const [error, setError] = useState<string | null>(null)

  const isDefault = loadRelayUrl() === defaultRelayUrl
  const dirty = url.trim() !== loadRelayUrl() && !(url.trim() === '' && isDefault)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (trimmed && !isValidRelayUrl(trimmed)) {
      setError('Zadejte platnou WebSocket adresu (wss:// nebo ws://).')
      return
    }
    saveRelayUrl(trimmed)
    location.reload()
  }

  return (
    <>
      <p className="modal-section-label" style={{ marginTop: 20 }}>
        Synchronizační server
      </p>
      <p className="modal-hint">
        Výchozí server ({defaultRelayUrl}) je zdarma a má omezenou kapacitu.
        Vlastní server nastavte na <strong>všech zařízeních</strong>, která se
        mají synchronizovat. Prázdné pole = výchozí server. Uložení znovu
        načte aplikaci.
      </p>
      <form onSubmit={handleSave}>
        <input
          className="settings-input"
          style={{ width: '100%', boxSizing: 'border-box' }}
          placeholder={defaultRelayUrl}
          value={url}
          onChange={e => {
            setUrl(e.target.value)
            setError(null)
          }}
        />
        {error && <p className="mnemonic-error">{error}</p>}
        <div className="settings-actions">
          <button type="submit" className="modal-restore-btn" disabled={!dirty}>
            Uložit a načíst znovu
          </button>
        </div>
      </form>
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
        : 'Zadejte platnou zálohovací frázi (slova oddělená mezerou).'
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
        <div className="modal-title">Nastavení</div>

        {/* ── Flyer identity (default) ── */}
        <Suspense fallback={<p className="modal-hint">Načítání…</p>}>
          <IdentitySettings />
        </Suspense>

        {/* ── Workspaces / organizations ── */}
        <Suspense fallback={<p className="modal-hint">Načítání…</p>}>
          <OrganizationsSettings />
        </Suspense>

        {/* ── Mnemonic display ── */}
        <p className="modal-section-label" style={{ marginTop: 20 }}>Zálohovací fráze</p>
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
            placeholder="Zadejte slova zálohovací fráze…"
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

        {/* ── Relay ── */}
        <RelaySettings />

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
