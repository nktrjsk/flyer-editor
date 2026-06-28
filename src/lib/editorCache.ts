import type { ConceptMeta } from '../types'

/**
 * Snapshot of the editor's visible state, persisted to localStorage so the app
 * can paint a fully-populated (but non-interactive) placeholder on the next
 * load — instead of an empty editor — while Evolu/OPFS boots in the background.
 */
export interface EditorCache {
  activeId: string | null
  concepts: Array<{ id: string; title: string }>
  meta: ConceptMeta
  markdown: string
}

const KEY = 'flyer-editor:lastEditor'

export function readEditorCache(): EditorCache | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EditorCache
    // Minimal shape guard — ignore corrupt/old payloads rather than crash.
    if (!parsed || typeof parsed.markdown !== 'string' || !parsed.meta) return null
    return parsed
  } catch {
    return null
  }
}

export function writeEditorCache(cache: EditorCache): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // Quota exceeded (e.g. a large logo data URL) or private mode — the cache
    // is a best-effort nicety, so silently skip rather than break editing.
  }
}
