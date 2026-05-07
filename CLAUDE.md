# Mental Meter — Agent Instructions

(Renamed from "Psych Battery" — repo URL still uses the old slug.)

## What this repo is

A UC Berkeley PhD research app that visualizes a user's mental energy as a pixel-art battery. Fork of `elisa-lj11/psych-battery`.

**Current state (not a constraint):** `index.html` is ~16,286 lines of vanilla JS + CSS in one file with no build step. This started as a one-file app and has grown past the point where that's a benefit. **Splitting into `index.html` + `app.css` + `app.js` (and per-feature modules) is welcome and recommended** — it's blocked by no architectural rule, only by "we haven't done it yet." Codex dispatches against the single file currently fail rule #5 of the avoidance list (>5k-line single-file apps), so the split also unblocks delegation.

**CrowPanel firmware:** always use `arduino-cli` for upload/flash. Don't hand-build scripts. Verify port first with `arduino-cli board list`, then `arduino-cli upload -p COM<n> --fqbn esp32:esp32:esp32s3 <sketch-dir>`.

**Pre-merge review:** use `/walmart-ultrareview main...HEAD` from inside this repo (not the parent Drive folder, which isn't a git repo). The standard `/ultrareview` is blocked by the "not in git repo" check when run from `Claude Research Folder/`.

**Live:** https://psych-battery.vercel.app  
**Repo:** https://github.com/douglaspmcgowan/psych-battery (private fork)  
**Local clone:** `C:\Users\dougl\My Drive (douglaspmcgowan@gmail.com)\UC Berkeley\Research\Claude Research Folder\psych-battery-app\`

## Companion repo

The Flask backend lives in a **separate repo**: `dpm-research-hub` (also at `douglaspmcgowan/dpm-research-hub`). Local clone is a sibling directory. The frontend calls it directly at `http://localhost:7070` — CORS is enabled on all routes.

## Architecture

```
Browser (index.html served by server.py at :3131)
  ├── GET /aw/*  →  server.py proxies  →  ActivityWatch (localhost:5600)
  ├── GET http://localhost:7070/state  →  Flask backend (direct, CORS allowed)
  └── POST http://localhost:7070/log   →  Flask backend (direct, CORS allowed)

Flask backend (dpm-research-hub/integrations/models/main.py)
  ├── Every 5 min: fetches AW, Slack, GCal, Zoom, Todoist, Apple Health, Keystrokes, Proximity
  ├── Ticks Model B (Energy E + Stress S ODE) and Model D (circadian baseline)
  └── Writes state to ~/.psych-battery/state.json

CrowPanel e-ink display (optional)
  └── crowpanel/charge_sender.py polls :7070/state, sends over USB Serial
```

## Running locally

```bash
# Start Flask backend (from dpm-research-hub sibling dir)
cd ../dpm-research-hub && python -m integrations.models.main

# Start proxy + static server (from this repo)
python server.py         # serves http://localhost:3131

# Or one-command:
bash run-local.sh        # starts both + opens browser
```

Demo mode works with zero setup — pick a profile from the dropdown. ActivityWatch and Flask backend are optional.

## Key files

| File                             | Purpose                                                                 |
| -------------------------------- | ----------------------------------------------------------------------- |
| `index.html`                     | Entire frontend (16 k lines, vanilla JS)                                |
| `server.py`                      | Minimal Python proxy: serves index.html, forwards `/aw/*` → AW at :5600 |
| `run-local.sh` / `run-local.bat` | One-command launchers (Mac/Linux, Windows)                              |
| `check-health.py`                | Stdlib health check for both servers                                    |
| `crowpanel/`                     | CrowPanel e-ink firmware + Python bridge + setup brief                  |
| `vercel.json`                    | Static deploy config (all routes → index.html)                          |

## Frontend architecture (index.html)

### App state

```js
const APP = {
  uiLayer: 0, // 0=battery only, 1=metrics, 2=diagnostics
  mode: "normal", // 'normal'|'rating'|'recovery-menu'|'screensaver'
  model: { online, stale, payload, lastFetchAt },
  aw: {
    online,
    windowHours,
    buckets,
    breakdown,
    fallbackBattery,
    totalActMins,
  },
  rating: { kind, submitting },
  recovery: {
    activityId,
    logKind,
    theme,
    plannedMin,
    startTs,
    timerId,
    toggleActive,
  },
};
```

### UI layers

- **Layer 0** (default): Large pixel-art battery SVG, %, 4 color themes
- **Layer 1** (tap battery): Drain-pressure bar (12 pixel segments), drain vs recovery feature rows with mini-bars
- **Layer 2** (tap "Show full diagnostics"): Circadian model chart (SVG), pixel E+S state tanks, particle field

### Modes

- `normal` → default
- `rating` → Energy/Stress 1–10 sheet open
- `recovery-menu` → Activity selection sheet open
- `screensaver` → Full-screen canvas animation

### Recovery modes (two kinds)

- **Instant**: tap activity → duration stepper → Start → screensaver → Done → one POST /log
- **Toggle**: tap activity with toggle option → banner appears bottom-right with "END" → tap END → POST /log with elapsed time

### Demo profiles

Four synthetic profiles selectable from header dropdown: Sam, Maya, Alex, Jordan. Each provides a full `payload` (E_display, E_internal, S, E_rest_now, chronotype, last_tick_iso, last_feats with all 18 keys) and `aw` breakdown. Demo mode short-circuits all fetch calls.

### Themes

Five CSS var themes: `editorial` (default), `arcade`, `gameboy`, `amber`, `phosphor`. Stored in localStorage `pb_theme`. Applied via `body[data-theme]`.

The `editorial` theme overrides the pixel-art SVG battery with a CSS-drawn vertical device: `clip-path: path()` battery+tip shape, B&W inner screen fill via `@property --battery-pct`, LED stress ring via `::after`. See lines ~5122–5230 in `index.html`.

### Polling

- `/state` every 30s (paused when tab hidden)
- `/aw/*` only when `uiLayer >= 1`
- `localStorage('pb_state')` cache used when Flask offline

## Flask backend contract

`GET /state` returns:

```json
{
  "E_display": 0.0–1.0,
  "E_internal": 0–100,
  "S": 0–100,
  "E_rest_now": 0–100,
  "last_tick_iso": "ISO8601",
  "last_feats": { ...18 keys... },
  "phase": 0|1|2,
  "chronotype": "lark"|"intermediate"|"owl"
}
```

`POST /log` accepts:

```json
{ "kind": "outside"|"walk"|"with_people"|"detach"|"energy_rating"|"stress_rating", "minutes": float, "value": int }
```

## Known bugs (as of May 4 2026)

1. **[P2] No tap affordance on battery** (battery-toggle button in layer 0): First-time users have no way to know tapping the battery expands it. Add a small "TAP TO EXPAND" hint or a visible chevron below the battery in layer 0.

Previously listed bugs that are now fixed: toggle-recovery state corruption (awaits endToggleRecovery before overwriting — line 15206), particle loop during screensaver (mode check in loop guard — line 13087), prefers-reduced-motion dynamic changes (matchMedia change listener added), theme picker / help button overlap (help trigger moved to top row — line 7590), toggle banner touch target (min-height: 44px already set — line 4469).

## Coding rules

- **Vanilla JS only** — no React, Vue, npm, build tools
- **Single file** — keep everything in index.html
- **Mobile-first** — touch targets ≥ 48px, safe-area insets via `env(safe-area-inset-bottom)`
- **No comments** unless the WHY is non-obvious
- Deploy is automatic: push to `main` → Vercel deploys `index.html` as static

## Design system

```css
:root {
  --bg: #0f0f13;       --surface: #1a1a24;    --surface-2: #22223a;
  --border: #2a2a3a;   --border-light: #333350; --text: #e0e0f0;
  --muted: #6060a0;    --good: #4ade80;         --warn: #facc15;
  --low: #fb923c;      --critical: #f87171;     --accent: #818cf8;
}
/* Pixel-art vars (active theme) */
--px-font-ui: 'Silkscreen', monospace;
--px-font-mono: 'VT323', monospace;
--px-accent, --px-good, --px-warn, --px-critical, --px-border, etc.
```

## Tests

```bash
node e2e/editorial-full.mjs   # Playwright walkthrough — server must be on :3131
```

80 steps, ~0 issues expected. Run after any index.html change. If server was already running before your edit, restart it first (`pkill -f "python server.py" && python server.py &`) — it caches index.html at startup.

## Brief files (for handing off to other agents)

- `C:\Users\dougl\AppData\Local\Temp\psych-battery-codex-brief.txt` — original planning brief (architecture, API contract, UI requirements)
- `C:\Users\dougl\AppData\Local\Temp\psych-battery-impl-brief.txt` — implementation brief (DOM structure, CSS tokens, JS state machine, full spec)
- `crowpanel/CROWPANEL_SETUP.md` — self-contained brief for setting up the e-ink display

## Delegating to Codex

Use `codex exec review` for code review (run from repo root). Use `codex exec` with a prompt for implementation tasks. Filter output carefully — apply only changes you're 95% confident in.

After any CSS positioning or layout change: **take a screenshot** (computer-use) at both desktop and mobile widths before declaring done. Code review alone misses visual conflicts.
