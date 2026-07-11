// A cheap, deterministic content fingerprint used to answer one question in the
// sidebar: "has this flyer's working copy drifted from what was last published?"
//
// It is a LOCAL comparison only (never matched against the repo), so it just has
// to be (a) computed identically at publish time and at sidebar-render time and
// (b) sensitive to editable-content changes.
//
// It covers exactly the per-concept editable fields — the same set useAutoSave
// writes and `contentKey` tracks — and deliberately excludes:
//   • version / publishedAt — publish-specific, would always read as drifted;
//   • org / web / year — auto-derived shared identity, not per-concept content;
//   • the base64 logo payload — not available per-row in the sidebar list query,
//     so we key on the immutable `logoId` reference instead (a new upload gets a
//     new id → detected as a change; editing a legacy inline logo is not).

export interface FingerprintInput {
  title: string
  fontSize: number
  palette: string | null
  logoId: string | null
  markdown: string
}

/** FNV-1a 32-bit hash of the normalized content, as 8 hex chars. */
export function releaseFingerprint(c: FingerprintInput): string {
  const s = JSON.stringify([
    c.title,
    c.fontSize,
    c.palette ?? 'color',
    c.logoId ?? null,
    c.markdown,
  ])
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
