# Product

## Register

product

## Users

Today: a single power user (the author) — a Czech-speaking writer/activist producing an A5
flyer series (e.g. the pro-open-borders set), editing across multiple devices via mnemonic
sync. He works in long focused writing sessions: Markdown on one side, live A5 preview on
the other, printing or exporting when a flyer is done.

Ambition: grow into a tool for collaborators (volunteers co-editing flyers) and eventually
a public tool anyone can pick up. Design decisions should not paint the UI into a
single-power-user corner — affordances must stay learnable, not memorized.

UI copy is Czech-first.

## Product Purpose

A browser-based, local-first A5 flyer editor: Markdown in, print-ready HTML/PDF out.
Content lives in the browser (Evolu/SQLite) and syncs across devices; no server of its
own. Snapshots give working history with safe restore; a local AI bridge lets external
Claude propose edits, always human-gated.

Success looks like: a flyer goes from draft to printed A5 without the tool ever getting in
the way — no lost work, no surprise layout shifts between preview and print, no fighting
the editor.

## Brand Personality

Quiet workshop. Calm, bookish, understated — a dim print shop where the lit object is the
paper page. The editor chrome recedes; the A5 preview is the star. Focused rather than
featureful, crafted rather than flashy.

Note (2026-07): the current implementation of this personality is not liked by the owner
and is slated for redesign. The *direction* (quiet workshop) is confirmed; the *execution*
(current palette, chrome, and component styling) is not the reference — treat existing CSS
as legacy to improve, not a system to preserve.

## Anti-references

- **Generic SaaS dashboard chrome** — card grids, gradients, icon tiles, hero metrics.
  This is a writing/print tool, not an analytics product.
- **Design-tool maximalism** (Canva/Figma-style) — floating toolbars, panel forests,
  property inspectors everywhere. The editing surface is Markdown text, not canvas objects.
- **Dark-hacker / terminal aesthetic** — despite the dark chrome, this must not drift into
  code-editor or cyberpunk territory. The mood is print shop, not terminal.

## Design Principles

1. **The page is the star.** Every visual decision in the chrome is judged by whether it
   makes the A5 preview more prominent and legible. Chrome recedes; paper glows.
2. **Print truth.** The preview is a promise about paper. Fidelity between screen and
   printed output beats any screen-only flourish; overflow and fit problems are surfaced,
   never hidden.
3. **Disappear into the task.** Standard, earned affordances — no invented controls for
   standard jobs. A fluent user should never pause at a component; a new collaborator
   should never need a manual.
4. **Calm over clever.** Motion and color convey state (sync, overflow, proposals),
   never decorate. 150–250 ms transitions; nothing choreographed.
5. **The human is the gate.** Anything that replaces content — AI proposals, snapshot
   restores, resets — is explicit, reviewable, and reversible. The UI makes the gate
   visible, not buried.

## Accessibility & Inclusion

Sensible defaults, no formal certification target:

- WCAG AA contrast (≥4.5:1 body text, ≥3:1 large text) across the editor UI.
- Fully keyboard-usable editing and navigation.
- `prefers-reduced-motion` respected on every animation.
