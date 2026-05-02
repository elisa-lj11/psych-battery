# Current Task: Light-mode pass + UX fixes

**Goal:** Make the entire app work in light mode (no dark text on dark, no dark
text on light, no dark backgrounds where they shouldn't be), plus a list of
specific UX fixes the user enumerated. User is going to bed — work autonomously
through the list, screenshot each fix, push when done.

**Branch:** `feat/mental-meter-phase-portrait` (already 13 commits ahead of upstream)

## Done this session

- Demo activity layout: 2-column, scene panel left, diagnostics+timeline+E/S right, Back button visible
- CSS alias bug: replaced all 31 usages of `var(--surface)`/`var(--surface-2)`/`var(--border)` with their `--px-*` originals (the alias was frozen at arcade dark values because of how `:root`-level var() resolution works)
- Demo toggle button no longer always-accent (now button-surface when not in demo)
- Light + pastel themes redone: warm cream / lavender-white backgrounds, sage / lavender accents
- Pastel moved from DARK_THEMES to LIGHT_THEMES
- Default theme = light
- Rating sheet: compact 1-10 row, no description text, centered
- Commit `8b191e0`

## Remaining work (full list per user, in their order)

### Light-mode contrast pass (audit first, then fix)

1. **1-10 rating buttons**: too thin, hard to read text. Apply to BOTH energy AND stress sheets (I only verified energy before).
2. **Recovery exercise start dialogue**: bigger / more sans-serif. Hard to read currently.
3. **Recovery back button**: invisible. Fix.
4. **Calibration / TUNE dialog**: black text on dark, hard to see. Full pass.
5. **Circadian model graph**: still dark in light mode, should match light bg.
6. **State tanks**: still dark in light mode.
7. **Phase portrait**: still dark in light mode.
8. **Energy + stress mini graphs**: dots are fine; just make sure the empty space inside the box is filled (graph fills the box).
9. **Empty space under Replay Last Tick / Run +1 Hour**: fill it.
10. **Raw diagnostics bar in dropdown**: remove.
11. **Collapse text size/type**: match Show Signal Breakdown.
12. **Back to Battery button**: position: sticky / fixed at top of viewport on scroll.

### Demo box specific

13. **Demo dialog window**: center it. Window text → match Interactive Demo text size/type.
14. **Interactive demo overall**: still dark in light mode. Major color rework needed — DELEGATE TO CODEX.
15. **E/S batteries**: wider, move both + timeline all the way to the right (more room for left animation).
16. **Timeline**: too transparent, no overlap bar — just have a single bar on the right.

### Process / meta

17. Document recommendations for not losing long prompts (write `LONG-PROMPT-RECOMMENDATIONS.md`).
18. Push everything once verified.

## Verifier

After each change: `node snap-demo.js` + `node snap-layer2.js` and check screenshots in `screenshots/` (must be in light mode — default).
For calibration / recovery flows that need interaction, write targeted snap scripts in the same pattern.

## Failure mode that triggered this

User pointed out I was claiming things "done" without checking light-mode in
every flow, and dropped multiple items on the floor across compaction events.
The fix is THIS file + the TodoWrite list — both are durable and force me to
re-anchor on the actual list every turn.
