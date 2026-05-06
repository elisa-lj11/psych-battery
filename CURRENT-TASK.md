# CURRENT-TASK.md

## Goal

Fix UI issues found by Playwright audit + rename variables in model UI.

## Completed

- [x] Renamed DEMO → MENU (header dropdown summary)
- [x] Replaced `<details id="theme-picker">` with `<button id="theme-mode-toggle">` (single toggle)
- [x] Removed `#demo-toggle-btn:hover` from bad grouped CSS rule (was setting `color: var(--px-bg)` = invisible text)

## In Progress

- [ ] Fix 4: Demo batteries side-by-side + shorter (`.demo-state-row .demo-battery-pair` flex-direction: row; `.demo-batt-svg-v` height: 200→80px)
- [ ] Fix 5: Rename `erest` → `C` (circadian floor) across entire site
- [ ] Fix 6: Rename `pressure` → `D` (drain) across entire site
- [ ] Run Playwright visual-audit.mjs to verify all fixes
- [ ] Commit + push + deploy

## Key files

- `C:/Users/dougl/psych-battery/index.html` — single-file frontend (~17,500 lines)

## Variables to rename

- `erest` → `C` (circadian floor) — all display text, labels, tooltips, JS vars, CSS classes
- `pressure` → `D` (drain) — all display text, labels, tooltips, JS vars, CSS classes
- Short forms: E_rest → C, P → D (check what short labels are used in charts/axes)

## Verifier

```
cd C:/Users/dougl/psych-battery && node e2e/visual-audit.mjs
```

Then check screenshots in `e2e/screenshots/audit/`.
