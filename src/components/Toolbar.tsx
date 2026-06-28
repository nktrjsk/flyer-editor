interface ToolbarProps {
  onOpenSettings: () => void
  onSaveSnapshot: () => void
}

export default function Toolbar({ onOpenSettings, onSaveSnapshot }: ToolbarProps) {
  return (
    <header className="toolbar">
      <span className="toolbar-title">Samostuduj · editor letáku</span>
      <div className="toolbar-actions">
        <button onClick={onSaveSnapshot}>📷 Uložit zálohu</button>
        <button onClick={onOpenSettings}>⚙ Nastavení</button>
        <button onClick={() => window.print()}>⎙ Tisknout / PDF</button>
      </div>
    </header>
  )
}
