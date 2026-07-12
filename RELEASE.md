# Release — flyer-editor

- **Layer**: L0 (personal tool — users ≈ the author)
- **Versioning**: CalVer (`YYYY.MM` / `YYYY.MM.PATCH`)
- **Staleness cap**: 3 weeks
- **Release command**: `npm run release` (gates → bump → tag → push → GitHub release)
- **Deploy target / rollback**: GitHub Pages via Actions (deploy on push to `main`);
  rollback = re-run the previous green "Deploy to GitHub Pages" workflow run, or
  `git revert` + push
- **Announce channels**: GitHub Releases (notes distilled from git log)

## Smoke list (L0: golden path on prod after deploy; full list when touching storage/print)

1. **Golden path**: open the live app → new concept → type title + markdown →
   A5 preview updates live → Tisknout/PDF shows a correct A5 layout in the
   print dialog  ← golden path
2. Fresh-profile boot: skeleton placeholder → working editor (Evolu/OPFS +
   coi-serviceworker init on a browser that has never seen the app)
3. Zálohy: uložit zálohu → edit → restore from Historie, diff renders
4. Export PNG/JPEG downloads an image matching the preview
5. Stáhnout HTML → the file opens standalone with correct fonts/layout
6. Publikovat → flyer lands in the publish repo with correct release status
   in the sidebar

**Known issue (not a gate):** sync relay `wss://free.evoluhq.com` is over
quota/502 — cross-device sync is down regardless of app version. Tracked
separately; a release doesn't wait for it.

## Launch checklist (first release — delete when done)

- [x] Name and deploy target settled (GitHub Pages, `/flyer-editor/`)
- [ ] Rollback verified to actually work (re-run an old deploy workflow once)
- [x] License chosen (MIT, in repo)
- [x] Privacy posture written down (README: data žijí v prohlížeči, žádný server)
- [x] "Good enough" bar: editor + zálohy + export + publish all shipped
- [ ] Soft launch: n/a (L0 — author is the audience)
