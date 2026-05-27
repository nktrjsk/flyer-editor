export default function App() {
  return (
    <>
      <header className="toolbar">
        <span className="toolbar-title">Samostuduj · editor letáku</span>
        <div className="toolbar-actions">
          <button onClick={() => window.print()}>⎙ Tisknout / PDF</button>
        </div>
      </header>
      <div className="editor-layout">
        <div className="sidebar" />
        <div className="source-pane" />
        <div className="preview-pane" />
      </div>
    </>
  )
}
