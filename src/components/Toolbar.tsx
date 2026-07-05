import { Archive, Printer, Settings, Upload } from 'lucide-react'
import AiConnect from './AiConnect'
import SyncStatus from './SyncStatus'

interface ToolbarProps {
  onOpenSettings: () => void
  onSaveSnapshot: () => void
  onPublish: () => void
}

export default function Toolbar({ onOpenSettings, onSaveSnapshot, onPublish }: ToolbarProps) {
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
        <button onClick={onPublish}>
          <Upload size={15} strokeWidth={1.8} aria-hidden="true" />
          Publikovat
        </button>
        <button onClick={onOpenSettings}>
          <Settings size={15} strokeWidth={1.8} aria-hidden="true" />
          Nastavení
        </button>
        <button className="toolbar-primary" onClick={() => window.print()}>
          <Printer size={15} strokeWidth={1.8} aria-hidden="true" />
          Tisknout / PDF
        </button>
      </div>
    </header>
  )
}
