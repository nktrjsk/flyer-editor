---
name: Editor letáku
description: Local-first A5 flyer editor — a dim print shop where the lit A5 page is the only bright object.
colors:
  # ── Chrome (--ui-*): the dim room. OKLCH is canonical in src/style.css.
  room-deep: "oklch(0.22 0.010 80)"
  panel: "oklch(0.255 0.008 80)"
  content: "oklch(0.28 0.008 80)"
  surface: "oklch(0.33 0.009 80)"
  surface-hover: "oklch(0.37 0.010 80)"
  row-hover: "oklch(0.30 0.008 80)"
  border: "oklch(0.40 0.012 80)"
  border-strong: "oklch(0.50 0.014 80)"
  text-bright: "oklch(0.93 0.012 85)"
  text-mid: "oklch(0.80 0.015 82)"
  text-dim: "oklch(0.70 0.014 80)"
  brass: "oklch(0.78 0.125 78)"
  brass-hover: "oklch(0.83 0.125 80)"
  on-brass: "oklch(0.23 0.030 80)"
  brass-tint: "oklch(0.78 0.125 78 / 0.13)"
  danger: "oklch(0.70 0.160 28)"
  danger-bg: "oklch(0.52 0.185 28)"
  success: "oklch(0.76 0.140 150)"
  # ── Flyer (the paper itself; hex is canonical, user-facing print output)
  flyer-teal: "#1d6a5e"
  flyer-teal-wash: "#eaf3f1"
  flyer-paper: "#faf9f6"
  flyer-ink: "#1c1c1e"
  flyer-muted: "#5c5c5c"
  flyer-rule: "#d4d0c8"
typography:
  display:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: "34pt"
    fontWeight: 600
    lineHeight: 1.05
  prose:
    fontFamily: "'Crimson Pro', Georgia, serif"
    fontSize: "9.5pt"
    lineHeight: 1.58
  title:
    fontFamily: "'Source Sans 3', -apple-system, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  body:
    fontFamily: "'Source Sans 3', -apple-system, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "'Source Sans 3', -apple-system, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.01em"
  mono:
    fontFamily: "ui-monospace, 'Cascadia Code', 'SF Mono', Consolas, monospace"
    fontSize: "13px"
    lineHeight: 1.7
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  room: "36px"
components:
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.on-brass}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
  button-primary-hover:
    backgroundColor: "{colors.brass-hover}"
  button-ghost:
    textColor: "{colors.text-mid}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-bright}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-mid}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text-bright}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-bright}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  list-item-active:
    backgroundColor: "{colors.brass-tint}"
    textColor: "{colors.text-bright}"
    rounded: "{rounded.md}"
    padding: "9px 10px"
  badge-accent:
    backgroundColor: "{colors.brass-tint}"
    textColor: "{colors.brass}"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
---

# Design System: Editor letáku

## 1. Overview

**Creative North Star: "The Dim Print Shop"**

The editor is a dim workshop in warm deep grays, and the A5 preview is the one lit
object in the room. Every chrome decision is judged by whether it makes the paper more
prominent: panels sit in a narrow band of dark warm-gray lightness steps, text is quiet
but AA-legible, and a single brass accent marks actions, selection, and focus — nothing
else. The paper page, by contrast, is bright, serif, and print-true: what you see on
screen is a promise about what comes out of the printer.

The system is split into **two worlds that never mix**. The flyer tokens (`--accent`,
`--bg`, `--font-display`, …) style only `.page` and its print output; the chrome tokens
(`--ui-*`) style everything around it. This is why the tool can be redesigned without
ever reflowing the paper. The chrome explicitly rejects PRODUCT.md's anti-references:
no generic SaaS dashboard chrome (no card grids, gradients, hero metrics), no
Canva/Figma design-tool maximalism (no floating toolbars or panel forests), and no
dark-hacker/terminal aesthetic — the mood is print shop, not code editor. Motion exists
only to convey state: 150–250 ms ease-out transitions, no choreography, and every
animation has a `prefers-reduced-motion` alternative.

**Key Characteristics:**
- Dark warm-gray chrome (hue ~80) receding around one bright A5 page
- One brass accent, used for action/selection/focus only — never decoration
- Two token worlds: `--ui-*` for the tool, flyer tokens for the paper; never crossed
- Sans chrome (Source Sans 3), serif paper (Fraunces + Crimson Pro), mono only for Markdown source and secrets
- Calm, state-only motion; AA contrast throughout; Czech-first UI copy

## 2. Colors

A dim room built from one warm-gray ramp, a single brass voice, and the untouched
colors of the paper itself.

### Primary
- **Brass** (`oklch(0.78 0.125 78)`): the chrome's only accent — filled primary
  buttons (the toolbar's Tisknout / PDF), the focus ring, active selection tint,
  proposal badges, and the armed trust-mode state. Warm printshop metal, not gold
  ornament. Hover brightens to `oklch(0.83 0.125 80)`; text on brass is the dark
  **On-brass** (`oklch(0.23 0.030 80)`); soft selection backgrounds use the 13%
  **Brass tint** (`oklch(0.78 0.125 78 / 0.13)`).

### Secondary
- **Flyer Teal** (`#1d6a5e`): the *paper's* accent — flyer titles, headings, bullet
  dashes, callout borders. It belongs to the printed object, never to the chrome.
  Its wash **Teal Wash** (`#eaf3f1`) backs blockquote callouts. The B&W palette
  swaps both to near-black/gray (`#1a1a1a` / `#efefef`) via `data-palette="bw"`.

### Tertiary (state colors, chrome only)
- **Danger** (`oklch(0.70 0.160 28)`): destructive text/borders (delete, reset,
  removed diff lines). Its filled form **Danger Fill** (`oklch(0.52 0.185 28)`) backs
  the overflow warning bars — the one place the UI is deliberately loud, because
  content is being lost.
- **Success** (`oklch(0.76 0.140 150)`): sync-online dot, added diff lines,
  proposal "to" values. A status voice, never a surface.

### Neutral
- **The room ramp** (hue 80, chroma ≤0.014, darkest → lightest): **Room Deep**
  (`oklch(0.22 0.010 80)`) is the preview room behind the page; **Panel**
  (`oklch(0.255 0.008 80)`) is toolbar + sidebar; **Content** (`oklch(0.28 0.008 80)`)
  is the source pane and modals; **Surface** (`oklch(0.33 0.009 80)`) is inputs and
  raised controls, hovering to `oklch(0.37 0.010 80)`; list rows hover on
  `oklch(0.30 0.008 80)`.
- **Borders**: hairlines only — `oklch(0.40 0.012 80)`, stepping to
  `oklch(0.50 0.014 80)` for toasts and emphasized outlines. Always 1px.
- **Text**: three steps — **Bright** (`oklch(0.93 0.012 85)`) for primary text,
  **Mid** (`oklch(0.80 0.015 82)`) for labels and secondary text, **Dim**
  (`oklch(0.70 0.014 80)`) for hints, placeholders, and timestamps. All three hold
  ≥4.5:1 on their surfaces.
- **The paper**: **Paper** (`#faf9f6`) with **Ink** (`#1c1c1e`) body text, **Muted**
  (`#5c5c5c`) meta text, and **Rule** (`#d4d0c8`) hairlines. These are print values —
  they answer to the printed page, not to the chrome's contrast math.

### Named Rules
**The Two Worlds Rule.** Flyer tokens style `.page` and print output; `--ui-*` tokens
style everything else. A chrome change must never alter the paper; a flyer-design
change must never touch the chrome. Crossing the namespaces is forbidden.

**The One Brass Rule.** Brass appears only on actions, selection, and focus — and at
most one *filled* brass control per view. If brass is decorating rather than pointing,
remove it.

## 3. Typography

**Display Font:** Fraunces (flyer titles/headings only; Georgia fallback)
**Prose Font:** Crimson Pro (flyer body only; Georgia fallback)
**Chrome Font:** Source Sans 3 (system-ui fallback) — the entire UI
**Mono Font:** ui-monospace stack — Markdown source, mnemonic words, diff view, code

**Character:** The serifs live on the paper; the tool speaks a single well-tuned sans.
The pairing contrast is between *worlds*, not between headings and body.

### Hierarchy
- **Display** (Fraunces 600, 34pt, 1.05): the flyer title on the page. JS auto-fits it
  down when long; brass never touches it — it renders in the flyer's own accent.
- **Prose** (Crimson Pro, `--base` 9.5pt default, 1.58): flyer body text; Fraunces
  600/11pt for `h2`, 300/10pt muted for `h3`. All sizes in pt/mm because they are
  print measurements.
- **Title** (Source Sans 3 600, 1rem): modal and panel titles. The chrome's largest
  type — deliberately small; nothing in the room may shout over the page.
- **Body** (Source Sans 3 500, 0.8125rem, 1.5): buttons, rows, form text — the chrome's
  workhorse size.
- **Label** (Source Sans 3 600, 0.75rem, +0.01em): pane labels, field labels, section
  headers. Sentence case, never uppercase-tracked eyebrows.
- **Mono** (13px, 1.7): the Markdown textarea, mnemonic grid, diff lines, `code` chips.

### Named Rules
**The Serif Stays on the Paper Rule.** Fraunces and Crimson Pro may only appear inside
`.page`. Chrome labels, buttons, and headings are always Source Sans 3 — a serif in
the chrome is a regression to the rejected pre-redesign look.

**The Fixed Scale Rule.** Chrome type uses a fixed rem scale (0.6875 / 0.75 / 0.8125 /
0.875 / 1rem). No fluid clamp() sizes in the tool; fluid type belongs nowhere near a
print-truth preview.

## 4. Elevation

Depth in the chrome is **tonal, not cast**: the room ramp's lightness steps (Room Deep
→ Panel → Content → Surface) plus 1px hairline borders do all the layering. Resting
chrome never has a shadow. Real shadows exist for exactly two reasons: the A5 page
glows as the lit object in the dim room, and true floating layers (modals, popovers,
toasts, the proposal gate) lift off the plane they cover.

### Shadow Vocabulary
- **Page glow** (`box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.45), 0 24px 64px rgba(0,0,0,0.5)`):
  the A5 page only — a hairline of rim light plus a deep soft throw. Removed in print.
- **Modal lift** (`0 16px 48px rgba(0,0,0,0.5)`): settings modal, History Explorer,
  confirm dialogs, recovery card (`0 8px 40px`).
- **Popover lift** (`0 12px 32px rgba(0,0,0,0.45)`): the AI-connect popover; the
  proposal review pane uses `0 12px 40px rgba(0,0,0,0.5)`.
- **Toast lift** (`0 8px 24px rgba(0,0,0,0.5)`): toast notifications.
- **Warning glow** (`0 ±2px 12px oklch(0.52 0.185 28 / ~0.5)`): overflow bars only —
  a danger-tinted spread that makes the loud state read as light, not chrome.

Floating layers stack on the semantic z-scale: `--ui-z-popover` (100) → proposal (200)
→ modal (300) → recovery (400) → toast (500). Arbitrary z-index values are forbidden.

### Named Rules
**The Lit Object Rule.** Only the page and true floating layers cast shadows. If a
resting panel, card, button, or input has a box-shadow, it's wrong — depth at rest is
a tonal step, never a shadow.

## 5. Components

Component character: **quiet until touched.** Controls rest as ghosts or flat
surfaces, gain a surface fill and brighter text on hover, and show the brass ring on
keyboard focus. Exactly one control per view is filled brass. All transitions
`0.15s` on background/color/border-color.

### Buttons
- **Shape:** gently rounded (6px), 1px border or none, Source Sans 3 500–600 at 0.8125rem.
- **Ghost** (default, toolbar): transparent at rest in Mid text; hover fills Surface
  and brightens to Bright text. Padding 7px 14px, icons 15px `lucide` stroke 1.8 at
  0.85 opacity with a 7px gap.
- **Secondary** (modals, panels): Surface fill + 1px Border at rest; hover steps to
  Surface-hover.
- **Primary** (one per view — e.g. Tisknout / PDF): filled Brass with On-brass text at
  600; hover brightens to Brass-hover. Never more than one on screen at rest.
- **Danger-outline** (delete data, reset): transparent with Danger text and a 45%-alpha
  danger border; hover tints the background 14% danger. Destructive actions are never
  filled red at rest.
- **Focus:** the global 2px brass `:focus-visible` ring, offset 2px — the one guaranteed
  brass appearance.

### Inputs / Fields
- **Style:** Surface fill, 1px Border, 6px radius, Bright text, padding 8px 10px;
  placeholders in Dim. Labels above in Label style with a 6px gap.
- **Focus:** border-color swaps to Brass (0.15s) — no glow, no ring inside forms.
- **Mono variants:** mnemonic and relay-URL inputs render in the mono stack at 0.75rem.
- **The Markdown source** is a chromeless textarea: transparent on the Content pane,
  mono 13px/1.7, brass caret — the writing surface, not a form control.

### Segmented toggle (palette Barevný / Černobílý)
- One 1px-bordered 6px pill, options separated by hairlines; active segment fills
  Surface with Bright text, inactive rests in Dim and hovers on Row-hover. Icon
  (15px) + word, never icon-only.

### Navigation (toolbar + sidebar)
- **Toolbar** (52px, Panel fill, hairline bottom): app title at Label weight left;
  ghost buttons, the sync chip, and the single brass primary right.
- **Sidebar** (280px, Panel fill, hairline right): concept rows at 0.875rem — Mid text,
  Row-hover on hover, Brass-tint + Bright 600 when active. Row actions (delete, flag)
  are invisible until row hover, then Dim → colored on their own hover.
- **Status chips** (sync, AI): an 8px dot + 0.75rem text — Success green when live,
  Danger when broken, pulsing while checking (pulse stops under reduced motion; the
  color still carries the state).

### Modals & floating layers
- Content fill, 1px Border, 10px radius, 24–28px padding, modal lift shadow, over a
  60–72% Room-black scrim. Popovers: 8px radius, 14–16px padding. Toasts: bottom-center,
  Surface fill with strong border, 8px radius, entering with an 8px rise + fade
  (fade-only under reduced motion).

### The A5 Page (signature)
- Fixed 148×210mm, Paper fill, 12mm/14mm padding, the page-glow shadow, serif type —
  the only bright, shadowed, serif object in the app. The title is edited directly on
  the page (contenteditable): invisible at rest, 6% currentColor wash on hover, brass
  ring offset 4px when focused, Muted placeholder at 55% when empty. All editing
  affordances vanish in print.
- **Overflow state:** when content is clipped, the page gets a 2px danger outline, the
  last lines fade out under a mask, and a full-width Danger-fill bar pins to the page
  bottom (plus a sticky one atop the viewport) spelling out that text will not print.
  Print truth is never softened to a corner badge.

### Proposal review gate (signature)
- A fixed bottom-right pane (Content fill, 10px radius, popover lift) with a brass
  "NÁVRH" badge, a mono diff (added = Success on 8% green, removed = Danger on 8% red),
  optional reject-reason input, ghost Zamítnout + brass Přijmout. The human gate is
  visually unmistakable but still quiet.

## 6. Do's and Don'ts

### Do:
- **Do** keep the two worlds separate: `--ui-*` for chrome, flyer tokens for `.page`.
  Restyling the tool must never reflow the paper (The Two Worlds Rule).
- **Do** reserve brass for actions, selection, and focus — one filled brass control
  per view, everything else ghost or surface (The One Brass Rule).
- **Do** express chrome depth as tonal steps on the hue-80 ramp with 1px hairlines;
  shadows belong only to the page and floating layers (The Lit Object Rule).
- **Do** hold AA contrast: ≥4.5:1 body text, ≥3:1 large text, placeholders included —
  verified pairs are Bright/Mid/Dim on their designated surfaces.
- **Do** keep motion at 150–250 ms ease-out, state-driven only, with a
  `prefers-reduced-motion` alternative for every animation.
- **Do** surface print problems loudly (danger bars, outlines, faded clip masks) —
  "overflow and fit problems are surfaced, never hidden."
- **Do** write UI copy Czech-first, sentence case, in the quiet-workshop voice.
- **Do** use the semantic z-scale tokens (popover 100 → toast 500); use lucide icons at
  15px / stroke 1.8 / 0.85 opacity, always paired with a word in buttons.

### Don't:
- **Don't** build "generic SaaS dashboard chrome" — no card grids, gradients, icon
  tiles, or hero metrics (PRODUCT.md anti-reference, verbatim).
- **Don't** drift into "design-tool maximalism (Canva/Figma-style)" — no floating
  toolbars, panel forests, or property inspectors everywhere.
- **Don't** slide into the "dark-hacker / terminal aesthetic" — dark chrome, yes;
  mono everywhere, scanlines, or neon, never. The mood is print shop, not terminal.
- **Don't** put Fraunces or Crimson Pro in the chrome — serif UI labels are the
  rejected pre-redesign look (The Serif Stays on the Paper Rule).
- **Don't** shadow resting chrome, use borders >1px, or reach for side-stripe accents,
  gradient text, or glassmorphism. Ever.
- **Don't** let anything in the room outshine the page: no bright panels, no saturated
  fills on inactive states, no chrome type larger than 1rem.
- **Don't** animate for decoration, choreograph page loads, or use arbitrary z-index
  values like 999.
- **Don't** print screen-only aids: overflow bars, placeholders, hover washes, and
  editing affordances must all be suppressed in `@media print`.

One-sentence audit test: *if a screenshot draws your eye anywhere but the A5 page
first, the chrome has failed.*
