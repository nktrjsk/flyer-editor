import { readEditorCache } from '../lib/editorCache'
import SourcePane from './SourcePane'
import PreviewPane from './PreviewPane'

const noop = () => {}

/**
 * Suspense fallback shown while Evolu/OPFS boots. Renders a fully-populated but
 * non-interactive (`inert`) replica of the editor from the localStorage cache,
 * so the swap to the live editor is near-invisible. With no cache (first ever
 * visit) it falls back to a neutral grey skeleton — never an empty/black UI.
 *
 * The real Sidebar can't be reused here: its HistoryPanel runs an Evolu query
 * that would suspend the fallback itself, so we replicate the sidebar's static
 * chrome instead.
 */
export default function EditorPlaceholder() {
  const cache = readEditorCache()

  if (!cache) return <EditorSkeleton />

  return (
    // @ts-expect-error inert is a valid HTML attribute (React 19) — keeps the
    // placeholder non-focusable so keystrokes can't be lost before hydration.
    <div className="editor-layout" inert="" aria-hidden="true">
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-label">Koncepty</span>
          <button className="sidebar-new-btn" tabIndex={-1}>+</button>
        </div>
        <div className="sidebar-list">
          {cache.concepts.map(c => (
            <div
              key={c.id}
              className={`sidebar-item${c.id === cache.activeId ? ' active' : ''}`}
            >
              <span className="sidebar-item-name">{c.title || '(bez názvu)'}</span>
            </div>
          ))}
        </div>
      </div>
      <SourcePane
        meta={cache.meta}
        markdown={cache.markdown}
        onMetaChange={noop}
        onLogoChange={noop}
        onMarkdownChange={noop}
      />
      <PreviewPane meta={cache.meta} markdown={cache.markdown} />
    </div>
  )
}

function EditorSkeleton() {
  return (
    // @ts-expect-error inert is a valid HTML attribute (React 19)
    <div className="editor-layout" inert="" aria-hidden="true">
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-label">Koncepty</span>
        </div>
        <div className="sidebar-list">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton skeleton-sidebar-item" />
          ))}
        </div>
      </div>
      <div className="source-pane">
        <div className="meta-section">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-field" />
          ))}
        </div>
        <div className="skeleton skeleton-textarea" />
      </div>
      <div className="preview-pane">
        <div className="page">
          <div className="skeleton skeleton-line title" />
          <div className="skeleton skeleton-line meta" />
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-line" />
          ))}
        </div>
      </div>
    </div>
  )
}
