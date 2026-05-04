# Tech Debt Audit — psych-battery / Mental Meter

Generated: 2026-05-04  
Branch: `feat/mental-meter-phase-portrait` (ahead of upstream/main)  
Auditor: Claude Sonnet (tech-debt-audit skill)

---

## Executive Summary

1. **No critical ship blockers.** The app is functional and deployable.
2. **One high-severity security issue**: a production Google OAuth client_secret lives in `credentials.json` at the repo root in the wrong location — one slip of `git add .` away from leaking to GitHub.
3. **Four forced layout reflows per second** in the layer-2 particle loop — minor jank risk on low-end devices but easily fixed.
4. **`_enrich_last_feats` silently swallows all exceptions** — AW parse failures, network errors, and format changes are all invisible. Debugging AW integration issues is currently guesswork.
5. **Two CLAUDE.md P1/P2 bugs are already fixed** (toggle-recovery corruption, particle loop during screensaver). The known-bugs list is stale.
6. **Repo root is a graveyard of planning artifacts** — 9 doc files, 6 launcher variants, 4 snap scripts, all committed and deploying to Vercel.
7. **`npm test` is hardwired to fail.** The e2e suite exists and is good; it just isn't wired up.
8. Remaining CLAUDE.md P2 bugs (theme picker overlap, `prefers-reduced-motion` dynamic change, touch target) are real and unresolved.

---

## Architectural Mental Model

The system is a single-file SPA (`index.html`, 16 k lines) that renders a pixel-art battery visualization of mental energy. The entire app — HTML, CSS (5000+ lines), and JS (7000+ lines) — lives in one file by explicit design choice. `server.py` (580 lines) is a Python proxy: it serves `index.html`, forwards `/aw/*` to ActivityWatch at :5600, and forwards `/log`/`/state` to a Flask backend at :7070. The Flask backend is in a separate repo and computes the energy/stress ODE model; `server.py` can synthesize a degraded state from ActivityWatch alone when Flask is offline.

The JS architecture is a flat script block with a single global `APP` state object. Event delegation wires most interactions to the HTML. The rendering model is functional-ish: most UI surfaces are re-rendered from scratch by dedicated `render*()` functions, not mutated in place. This is intentional and works well at this scale.

The design-system constraint says this is a local research app deployed to one person's Vercel. That context matters for calibrating severity below.

---

## Findings

| ID  | Category       | File:Line                | Severity | Effort | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Recommendation                                                                                                                                                                                          |
| --- | -------------- | ------------------------ | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Security       | `credentials.json:1`     | High     | S      | Production Google OAuth `client_secret` (`GOCSPX-3kOqcLk...`) at repo root. File is gitignored but exists here, not in `~/.config/psych-battery/` as the gitignore comment states. One `git add -f` or gitignore edit leaks it.                                                                                                                                                                                                                                        | Move to `~/.config/psych-battery/credentials.json`, delete from repo root, add `.gitignore` assertion in CI or pre-commit hook. Rotate the secret if you're unsure of prior exposure.                   |
| F02 | Performance    | `index.html:13104–13119` | Medium   | S      | `layer2AnimLoop` calls `getBoundingClientRect()` on 4 elements every ~240 ms inside an rAF loop. Forced layout reflow 4×/sec while layer 2 is visible.                                                                                                                                                                                                                                                                                                                 | Cache rects in a `resizeObserver` / `resize` handler. Invalidate cache on window resize.                                                                                                                |
| F03 | Error handling | `server.py:192–193`      | Medium   | S      | `_enrich_last_feats` (83 lines) wraps its entire body in `except Exception: pass`. All AW network errors, JSON parse failures, and unexpected-format responses are silently discarded.                                                                                                                                                                                                                                                                                 | Replace bare `pass` with `logging.warning("_enrich_last_feats: %s", exc, exc_info=True)`. At minimum log a count so you know when AW enrichment is failing.                                             |
| F04 | Accessibility  | `index.html:14901–14918` | Medium   | S      | `prefers-reduced-motion` is checked when the layer-2 particle loop _starts_ (`syncLayer2Motion`) but there's no `matchMedia.addEventListener('change', ...)`. If the user toggles the OS preference while on layer 2, the running rAF loop keeps going. CLAUDE.md bug #3.                                                                                                                                                                                              | Add `window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', syncLayer2Motion)` after the observer setup at line 14924.                                                        |
| F05 | Tests          | `package.json:7`         | Medium   | S      | `scripts.test` is `"echo Error: no test specified && exit 1"`. The real test suite (`node e2e/editorial-full.mjs`) exists and is 80 steps, but `npm test` always fails.                                                                                                                                                                                                                                                                                                | Change `scripts.test` to `"node e2e/editorial-full.mjs"`. Add a note that the server must be running.                                                                                                   |
| F06 | Security       | `index.html:8789`        | Low      | S      | `MODEL_BASE = localStorage.getItem("pb_api") \|\| ""` — all model API calls (`/state`, `/log`, `/demo-state`) use this as their base URL. Anyone who can write `localStorage` can redirect model traffic to an arbitrary origin. Low risk for a local app but it's an unvalidated trust boundary.                                                                                                                                                                      | Validate that `pb_api` matches `http://localhost:\d+` before use, or document that it's a debug override and strip it in prod builds.                                                                   |
| F07 | Arch decay     | repo root                | Low      | M      | 13 development-only files committed at repo root: `BACKGROUND-TASKS.md`, `CODEX-ISSUES.md`, `DAY_TIMELINE_PLAN.md`, `GLOBAL_CLAUDE.md`, `LONG-PROMPT-RECOMMENDATIONS.md`, `PLAN.md`, `SESSION_CONTEXT.md`, `snap-audit.js`, `snap-demo.js`, `snap-layer2.js`, `psych_battery_scorer.py`, `run-all.bat`, `run-all.ps1`. Vercel's catch-all rewrite means they don't publicly leak, but they inflate the deploy, confuse contributors, and will accumulate indefinitely. | Move agent context docs to `.claude/`, snap scripts to `tools/`, scorer to `tools/`. Add `e2e/screenshots/` to `.gitignore` (already there), check that `BACKGROUND-TASKS.md` etc. are in `.gitignore`. |
| F08 | Consistency    | `e2e/` + root            | Low      | S      | Four separate screenshot scripts doing similar but subtly different things: `screenshot.js`, `snap-audit.js`, `snap-demo.js`, `snap-layer2.js`. No canonical "take a screenshot at these breakpoints" utility.                                                                                                                                                                                                                                                         | Consolidate into one `tools/snap.js` with a `--scope` flag, or just delete the root-level ones — `e2e/editorial-full.mjs` supersedes all of them.                                                       |
| F09 | Docs           | `CLAUDE.md:8`            | Low      | S      | CLAUDE.md intro says "4650 lines" for `index.html`; the Key Files table (same file) correctly says "16 k lines". The intro was written when the file was smaller and never updated.                                                                                                                                                                                                                                                                                    | Fix line 8: change "4650 lines" → "16 k lines".                                                                                                                                                         |
| F10 | Known bug      | `index.html:~1062`       | Low      | S      | CLAUDE.md P2: theme picker and `?` help button both `position: fixed; top: ~10px; right: ~16px` — help button is buried. Not verified in code this session, but still listed as open in CLAUDE.md.                                                                                                                                                                                                                                                                     | Per CLAUDE.md: move help trigger left of theme picker or give it a different corner. Verify the overlap hasn't already been resolved before fixing.                                                     |
| F11 | Known bug      | `index.html:~767`        | Low      | S      | CLAUDE.md P3: `.toggle-banner-end` has no `min-height`. Touch target below 44px.                                                                                                                                                                                                                                                                                                                                                                                       | Add `min-height: 44px` to `.toggle-banner-end`.                                                                                                                                                         |

---

## Top 5 — if you fix nothing else, fix these

### 1. F01 — Move credentials.json out of the repo root

The secret is one command away from being committed and pushed to a public GitHub repo. The `.gitignore` comment already says where it should live (`~/.config/psych-battery/`). Just move it.

```bash
mkdir -p ~/.config/psych-battery
mv credentials.json ~/.config/psych-battery/
# Update any code that reads it from the repo root
```

Then rotate the secret at https://console.cloud.google.com — you can't know if it was ever in an IDE's LLM context, shell history, or clipboard.

### 2. F03 — Log `_enrich_last_feats` exceptions

The entire AW enrichment path fails silently. When AW integration misbehaves, there's no way to tell it's happening. One line fix:

```python
# server.py:192
except Exception as exc:
    logging.warning("_enrich_last_feats failed: %s", exc)
```

### 3. F04 — Wire prefers-reduced-motion change listener

The initial gate works but dynamic changes don't. Add after line 14924 in `index.html`:

```js
window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", syncLayer2Motion);
```

This also resolves CLAUDE.md bug #3 and you can remove it from the known-bugs list.

### 4. F05 — Wire `npm test`

```json
// package.json
"test": "node e2e/editorial-full.mjs"
```

The test suite is good. It just isn't callable via the standard interface.

### 5. F02 — Cache `getBoundingClientRect` in `layer2AnimLoop`

```js
// Declare at module level or in the observer callback:
let _cachedLayerRects = null;

// In syncLayer2Motion (runs on DOM change + resize):
_cachedLayerRects = null;

// In layer2AnimLoop, replace the 4 getBCR calls with:
if (!_cachedLayerRects) {
  _cachedLayerRects = {
    field: DOM.layer2ParticleField.getBoundingClientRect(),
    pressure: DOM.layer2PressureNode.getBoundingClientRect(),
    energy: DOM.layer2EnergyTank.getBoundingClientRect(),
    stress: DOM.layer2StressTank.getBoundingClientRect(),
  };
}
const { field, pressure, energy, stress } = _cachedLayerRects;
```

---

## Quick Wins

- [ ] **F09** — Fix `CLAUDE.md:8` line count (1 line change, 30 seconds)
- [ ] **F05** — Wire `npm test` in `package.json` (1 line change)
- [ ] **F03** — Add logging to `_enrich_last_feats` (1 line change)
- [ ] **F11** — Add `min-height: 44px` to `.toggle-banner-end`
- [ ] **F04** — Add `matchMedia` change listener (1 line)

---

## Things That Look Bad But Are Actually Fine

**`index.html` at 16,286 lines.** This is the intended architecture — "single file, no build step" is an explicit project constraint in CLAUDE.md. The file is not confused; it's a deliberate trade-off for zero-dependency deployment. The coding discipline (no comments unless WHY is non-obvious, consistent `render*()` pattern, centralized DOM cache, single `APP` object) makes it navigable. It would look like a god file to a visitor, but it's coherent.

**The `except Exception: pass` in `_enrich_last_feats` is intentional for availability** — the function's contract is "enrich if possible, return original payload otherwise." The problem isn't the pass; it's that there's no logging at all. The pattern itself is correct for a best-effort enrichment path.

**`MODEL_BASE` read at module-level startup** (line 8789). Reading localStorage at script parse time (before DOM ready) looks wrong but works fine in a browser where `localStorage` is synchronous and available before `DOMContentLoaded`. It also ensures the value can't be changed mid-session by a race condition.

**CLAUDE.md P1 toggle-recovery state corruption** — this is **fixed**. `index.html:15206–15208` now awaits `endToggleRecovery()` before overwriting `startTs`/`logKind`/`theme`. The entry in CLAUDE.md "Known bugs" is stale and should be removed.

**CLAUDE.md P2 particle loop runs during screensaver** — this is **fixed**. `index.html:13086–13087` now checks `APP.mode === "screensaver"` as an explicit stop condition in the loop's guard clause. Remove from known-bugs list.

**Six launcher scripts** (`run-local.sh`, `run-local.bat`, `run-all.bat`, `run-all.ps1`, `run-mac.sh`, `run.ps1`). Ugly but intentional — the project targets Windows, Mac, and Linux users who may or may not have PowerShell, and uses different launchers for different workflows (local only vs. local + CrowPanel). They're not maintained in tandem but they're also not on any hot path.

---

## Open Questions for the Maintainer

1. **`credentials.json` — has it ever been in a session context?** If you pasted its contents into a Claude Code or ChatGPT session, the secret should be rotated regardless of git status.

2. **PLAN.md (14 kB) and SESSION_CONTEXT.md** — are these still being actively used by agent sessions, or are they historical? If historical, they can be deleted or moved to `.claude/` to reduce repo noise.

3. **`psych_battery_scorer.py`** — this appears to be a standalone AW + GCal scoring script. Is it still used, or has it been superseded by the Flask backend in `dpm-research-hub`? If superseded, it's dead code.

4. **`e2e/full-app.test.mjs` (1605 lines)** — this was added in `c7b4bcf` as a comprehensive walkthrough. Is it maintained alongside `editorial-full.mjs`, or was it a one-shot generated test? If one-shot, it may have drifted.

5. **The `pb_api` localStorage override** — is this intentional for local development overrides only, or was it designed to allow pointing the app at a remote server? If the latter, the lack of origin validation is a more significant issue.
