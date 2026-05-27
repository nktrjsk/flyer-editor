interface ToolbarProps {
  onOpenSettings: () => void
}

export default function Toolbar({ onOpenSettings }: ToolbarProps) {
  return (
    <header className="toolbar">
      <span className="toolbar-title">Samostuduj · editor letáku</span>
      <div className="toolbar-actions">
        <button onClick={onOpenSettings}>⚙ Nastavení</button>
        <button onClick={() => window.print()}>⎙ Tisknout / PDF</button>
      </div>
    </header>
  )
}
