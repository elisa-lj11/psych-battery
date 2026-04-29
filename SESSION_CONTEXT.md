# Session Context — Apr 24 2026

This file captures the state of the psych-battery-app at the end of the Apr 24 2026 build session, so the next agent can pick up without re-investigating.

## What happened this session

### Starting point
- The previous build session had left a large uncommitted diff in `index.html` (1639 lines of additions, never pushed)
- The committed version on GitHub was the Apr 23 "pixel-art overhaul" commit (3105 lines)
- The local working copy had a substantial v2 redesign that was broken/incomplete per the user

### What was discovered
- The local `index.html` was actually complete and syntactically valid (JS syntax check passed, no TODOs)
- The "stopped working" was the session ending before the changes were committed, not a code bug
- The Flask backend already existed in the companion `dpm-research-hub` repo with full implementation
- Two ChatGPT brief files existed in Temp that documented the planning and implementation spec

### What was built/committed this session

**Commit `a22ebf4` — Layer 1+2 v2 redesign**
- Layer 1: Drain-pressure bar (12 pixel segments), drain vs recovery feature rows with mini-bars and tone-coded hints
- Layer 2: Circadian model chart (SVG, Model D baseline), pixel-art E+S state tanks, animated particle field
- Recovery system: two modes — instant log vs toggle (persistent banner until END)
- Theme picker redesigned as `<details>` dropdown pinned top-right
- New screensaver animations: breath, exercise, music, nap
- `normalizeFeature`, `computePressure`, `computeERest` pulled into frontend JS
- `loadTickHistory`, `saveTickSnapshot`, `replayLastTick`, `runOneHour` simulation helpers

**Commit `9d29e7d` — README v2 + run scripts + health check**
- `README.md` fully rewritten for v2 architecture
- `run-local.sh` / `run-local.bat` one-command launchers
- `check-health.py` stdlib health checker for both servers

**This session (not yet committed at time of writing)**
- `CLAUDE.md` — project agent instructions (this repo)
- `GLOBAL_CLAUDE.md` — copy of Doug's global Claude preferences
- `SESSION_CONTEXT.md` — this file
- Codex running: 6 bug fixes in index.html (see below)

## Known bugs (Codex fix in progress as of this session)

These were found via `codex exec review` and user observation:

1. **[P1] Toggle-recovery state corruption** (~lines 4500–4505): Starting a new timed recovery while a toggle is active overwrites state without cleanup.
2. **[P2] Particle loop runs invisibly during screensaver** (~lines 3342–3345): `APP.uiLayer` stays 2 when screensaver covers layer 2, so rAF keeps firing.
3. **[P2] prefers-reduced-motion not respected for particle rAF** (~lines 4331–4334): rAF always starts; needs `matchMedia` gate.
4. **[P2] Theme picker overlaps `?` help button**: Both `position: fixed; top: ~10px; right: ~10–16px`. Help button buried.
5. **[P2] No tap affordance on battery**: `#battery-toggle` is a button but has no visual hint in layer 0 that it's tappable.
6. **[P3] Toggle banner END button below 44px touch target** (~lines 767–769): `.toggle-banner-end` needs `min-height: 44px`.

## What's not done yet

### Near-term
- [ ] Verify Codex bug fixes (check the diff, screenshot the result)
- [ ] Browser test the full v2 at desktop and mobile widths
- [ ] Run `check-health.py` against a live local stack to verify Flask + AW

### Medium-term
- [ ] Set up credentials in `~/.psych-battery/secrets.env` (Slack, Todoist, Zoom, GCal)
- [ ] Test each integration independently (Slack, Todoist, etc.)
- [ ] Apple Health setup via Shortcuts (see `dpm-research-hub/integrations/apple_health/SHORTCUT_SETUP.md`)
- [ ] CrowPanel e-ink display setup (see `crowpanel/CROWPANEL_SETUP.md`)

### Long-term (not started)
- [ ] Model F (Kalman filter) and Model G (contextual bandit) — documented in `dpm-research-hub/docs/models-f-and-g.md`, needs weeks of real data first
- [ ] Mobile network access (currently localhost-only; need tunnel or LAN IP for phone)

## Repo state at end of session

```
main branch, up to date with origin/main
Last commit: 9d29e7d (README v2 + run scripts)
Local changes: CLAUDE.md, GLOBAL_CLAUDE.md, SESSION_CONTEXT.md (not yet committed)
                + Codex bug fixes to index.html (in progress)
```

## Key file locations

| What | Where |
|------|-------|
| Frontend app | `index.html` (4650+ lines) |
| AW proxy server | `server.py` |
| Flask backend | `../dpm-research-hub/integrations/models/main.py` |
| Planning brief | `C:\Users\dougl\AppData\Local\Temp\psych-battery-codex-brief.txt` |
| Implementation brief | `C:\Users\dougl\AppData\Local\Temp\psych-battery-impl-brief.txt` |
| CrowPanel brief | `crowpanel/CROWPANEL_SETUP.md` |
| Health check | `check-health.py` |
| One-command launcher | `run-local.sh` / `run-local.bat` |

## How to resume

1. Read `CLAUDE.md` for project rules and architecture
2. Check git status — Codex may have left uncommitted fixes to index.html
3. If Codex fixes are present: read the diff, verify, commit
4. Run `bash run-local.sh` to start both servers
5. Open http://localhost:3131, verify demo mode works, then test live mode
6. Screenshot at desktop + mobile widths to catch any layout regressions
