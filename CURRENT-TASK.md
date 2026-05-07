# CURRENT-TASK.md

## Status: IN PROGRESS — Tech Debt Cleanup

**Goal:** Address every open item in TECH_DEBT_AUDIT.md (F01–F11) that hasn't already been fixed.

### Remaining steps (do in order)

1. **Verify which items are already fixed** — read current code for F02 (particle loop), F04 (reduced-motion), F10 (theme picker overlap). Check CLAUDE.md for stale known-bugs references.
2. **F01 — credentials.json** — move `credentials.json` from repo root to `~/.config/psych-battery/`, update any code that reads it, rotate secret if needed.
3. **F03 — server.py logging** — replace bare `except Exception: pass` in `_enrich_last_feats` (server.py:192) with `logging.warning("_enrich_last_feats failed: %s", exc)`.
4. **F04 — prefers-reduced-motion** — add `window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', syncLayer2Motion)` after line 14924 of index.html (verify exact current line first). Remove bug from CLAUDE.md known-bugs.
5. **F05 — npm test** — change `package.json` scripts.test from the error stub to `"node e2e/editorial-full.mjs"`.
6. **F09 — CLAUDE.md line count** — fix "4650 lines" → "16 k lines" on line 8 of project CLAUDE.md.
7. **F11 — touch target** — add `min-height: 44px` to `.toggle-banner-end` in index.html.
8. **F02 — getBoundingClientRect cache** — cache rects in layer2AnimLoop via ResizeObserver (see TECH_DEBT_AUDIT.md for snippet).
9. **F07 — dev file cleanup** — move agent context docs to `.claude/`, root snap scripts to `tools/`. Check `.gitignore` covers BACKGROUND-TASKS.md etc.
10. **F08 — screenshot script consolidation** — delete root-level snap scripts (superseded by e2e/).
11. **F10 — theme picker overlap** — verify current state. If still overlapping, move help trigger left of theme picker.
12. **Commit + push to upstream/main.**

### Notes

- F06 (pb_api validation) is intentional debug override — skip.
- F01 is the only High severity item; do it first.
- F02, F04 may already be partially fixed — verify before touching.
- All other items are S (small) effort.

---

## Previously completed (this session)

All items shipped on feat/mental-meter-polish:

## What was done

- State tanks layout: side-by-side with "How the Model Works" text (changed
  `.layer2-viz-row` breakpoint from 920px → 440px, removed `min-height: 440px`
  and `min-height: 286px`); both columns now 595px equal height
- State tanks title: matched to `.layer2-explain-title` styling (same font-size,
  letter-spacing, color: var(--px-muted), uppercase)
- Dock buttons (LOG/RECOVERY/TUNE): opacity raised from 0.18 → 0.50 / border
  from 0.38 → 0.70 in editorial theme
- CSS toggle switch: replaced text button with pill+knob slider; `aria-pressed`
  controls knob position (light=left, dark=right)
- Demo batteries: confirmed side-by-side y=762 h=120 (mobile) and y=125 h=150
  (desktop) — Y diff 0px in both views

## Playwright audit results (last run)

- Toggle found: true ✅
- Header swatches: 0 ✅
- Demo grid batteries/timeline side-by-side at same Y ✅
- Activity view batteries/timeline side-by-side at same Y ✅
- State tanks h=595 | Model explain h=595 — aligned ✅
- All 5 help tabs ✅
- Phase portrait visible ✅
- Reset button label correct ✅
- JS error: only expected "Failed to fetch" (AW not running) ✅
