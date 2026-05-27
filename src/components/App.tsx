import { useState } from 'react'
import type { ConceptMeta } from '../types'
import { DEFAULT_META, DEFAULT_MARKDOWN } from '../types'
import Toolbar from './Toolbar'
import Sidebar from './Sidebar'
import SourcePane from './SourcePane'
import PreviewPane from './PreviewPane'

// Temporary stub until Evolu is wired in (Phase 3)
const STUB_CONCEPTS = [{ id: '1', title: 'Znakový jazyk' }]

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [meta, setMeta] = useState<ConceptMeta>(DEFAULT_META)
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN)

  function handleMetaChange(patch: Partial<ConceptMeta>) {
    setMeta(prev => ({ ...prev, ...patch }))
  }

  return (
    <>
      <Toolbar onOpenSettings={() => setSettingsOpen(!settingsOpen)} />
      <div className="editor-layout">
        <Sidebar
          concepts={STUB_CONCEPTS}
          activeId="1"
          onSelect={() => {}}
          onNew={() => {}}
          onDelete={() => {}}
        />
        <SourcePane
          meta={meta}
          markdown={markdown}
          onMetaChange={handleMetaChange}
          onMarkdownChange={setMarkdown}
        />
        <PreviewPane meta={meta} markdown={markdown} />
      </div>
      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Nastavení</div>
            <p style={{ color: '#888', fontSize: '10pt' }}>
              Nastavení synchronizace bude dostupné po integraci Evolu (Phase 3).
            </p>
            <div className="modal-footer">
              <button className="modal-close-btn" onClick={() => setSettingsOpen(false)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
