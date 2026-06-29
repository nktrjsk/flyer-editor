import AiConnect from './AiConnect'

interface ToolbarProps {
  onOpenSettings: () => void
  onSaveSnapshot: () => void
  onPublish: () => void
}

export default function Toolbar({ onOpenSettings, onSaveSnapshot, onPublish }: ToolbarProps) {
  return (
    <header className="toolbar">
      <span className="toolbar-title">Samostuduj · editor letáku</span>
      <div className="toolbar-actions">
        <AiConnect />
        <button onClick={onSaveSnapshot}>📷 Uložit zálohu</button>
        <button onClick={onPublish}>⬆ Publikovat</button>
        <button onClick={onOpenSettings}>⚙ Nastavení</button>
        <button onClick={() => window.print()}>⎙ Tisknout / PDF</button>
      </div>
    </header>
  )
}
