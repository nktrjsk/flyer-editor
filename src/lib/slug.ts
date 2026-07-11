// Turn a (Czech) flyer title into a readable, filesystem-safe folder slug.
//
// The published repo layout is `flyers/<slug>/vN.md` — the slug is the
// human-browsable folder name. Identity still lives in the frontmatter
// `publishId`, so the slug is free to be lossy/pretty; a degenerate title
// falls back to `flyer-<publishId>` so we never produce an empty folder.

/**
 * 'Otevřené hranice!' → 'otevrene-hranice'. Strips diacritics (NFD + drop the
 * combining marks Czech accents decompose into), lowercases, collapses any run
 * of non-alphanumerics to a single hyphen, trims, and caps length. Empty or
 * all-punctuation titles fall back to a publishId-derived slug.
 */
export function slugify(title: string, publishId: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks (U+0300–U+036F)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // any non-alphanumeric run → one hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 60)
    .replace(/-+$/g, '') // slice may have left a trailing hyphen
  return base || `flyer-${publishId}`
}
