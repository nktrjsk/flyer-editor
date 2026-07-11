import { useEffect, useRef, useState } from 'react'
import { Archive, ChevronDown, Download, LoaderCircle, Printer, Settings, Upload } from 'lucide-react'
import AiConnect from './AiConnect'
import SyncStatus from './SyncStatus'

interface ToolbarProps {
  onOpenSettings: () => void
  onSaveSnapshot: () => void
  onPublish: () => void
  isPublishing: boolean
  onExport: (format: 'png' | 'jpeg') => void
}

/** Toolbar dropdown offering PNG/JPEG image export — mirrors AiConnect's popover pattern. */
function ExportMenu({ onExport }: { onExport: (format: 'png' | 'jpeg') => void }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function pick(format: 'png' | 'jpeg') {
    onExport(format)
    setOpen(false)
  }

  return (
    <div className="export-menu" ref={wrapRef}>
      <button onClick={() => setOpen(o => !o)}>
        <Download size={15} strokeWidth={1.8} aria-hidden="true" />
        Stáhnout
        <ChevronDown size={13} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && (
        <div className="export-menu-popover">
          <button className="export-menu-item" onClick={() => pick('png')}>PNG</button>
          <button className="export-menu-item" onClick={() => pick('jpeg')}>JPEG</button>
        </div>
      )}
    </div>
  )
}

export default function Toolbar({ onOpenSettings, onSaveSnapshot, onPublish, isPublishing, onExport }: ToolbarProps) {
  return (
    <header className="toolbar">
      <span className="toolbar-title">Editor letáku</span>
      <div className="toolbar-actions">
        <SyncStatus />
        <AiConnect />
        <button onClick={onSaveSnapshot}>
          <Archive size={15} strokeWidth={1.8} aria-hidden="true" />
          Uložit zálohu
        </button>
        <button onClick={onPublish} disabled={isPublishing}>
          {isPublishing
            ? <LoaderCircle className="spin" size={15} strokeWidth={1.8} aria-hidden="true" />
            : <Upload size={15} strokeWidth={1.8} aria-hidden="true" />}
          {isPublishing ? 'Publikuji…' : 'Publikovat'}
        </button>
        <button onClick={onOpenSettings}>
          <Settings size={15} strokeWidth={1.8} aria-hidden="true" />
          Nastavení
        </button>
        <ExportMenu onExport={onExport} />
        <button className="toolbar-primary" onClick={() => window.print()}>
          <Printer size={15} strokeWidth={1.8} aria-hidden="true" />
          Tisknout / PDF
        </button>
      </div>
    </header>
  )
}
