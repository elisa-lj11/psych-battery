# Background tasks

## Mental Meter full-app audit (dispatched 2026-04-29)

**Type:** codex:codex-rescue subagent (background)
**Effort:** high, fresh thread
**Scope:** Read-only audit of index.html — functional bugs, UX issues, copy problems, visual/design critique, concrete design improvements, verify known bugs from CLAUDE.md.

**Expected output:** Single markdown punch list with 6 sections (functional/UX/copy/design/improvements/known bugs). 30–60 items total. Codex returns the report; Claude reviews with user before applying fixes.

**Codex job ID:** `task-mojl1ocx-bsbhed`
**Status check:** `/codex:status task-mojl1ocx-bsbhed`

**Re-dispatch if needed:** see prompt template in this session's history (search "auditing a single-file vanilla JS web app for the Mental Meter").

**Local clone:** `C:\Users\dougl\psych-battery\` (canonical for elisa-tracking work)
**Branch:** `feat/mental-meter-phase-portrait` (PR #3 still open on elisa-lj11/psych-battery)

## Mental Meter UI/UX overhaul + bug batch (dispatched 2026-05-01)

**v1 dispatch (KILLED):** `a321571a308847dea` — single broad agent. Stopped because it violated CLAUDE.md parallelization rule. Re-dispatched as 2 parallel agents on disjoint files.

### Agent A — Hardware/data sync

**Agent ID:** `ad558b1714e5e1008`
**Owns:** `psych_battery_crowpanel.ino`, `charge_sender.py`, `server.py`. Writes `STATE_CONTRACT.md`.
**Scope:**

- Diagnose webpage↔e-ink sync mismatch
- Plumb demo-mode values to e-ink
- Implement RGB LED states (R→IO15, G→IO17, B→IO21, 220Ω each, GND cathode): green=live, amber=stale, red=offline
- Add `status` field to `/state` JSON for UI agent to consume
- charge_sender.py heartbeat → server.py uses it to compute status

### Agent B — UI overhaul

**Agent ID:** `a70fd8ee9f9f08d7e`
**Owns:** `index.html` only. Writes `PLAN.md`. Reads `STATE_CONTRACT.md` from Agent A.
**Scope (3 phases):**

1. Research + screenshots + PLAN.md
2. Bug fixes + layout (recovery exit, demo scroll bounce, null-data hiding, connection-pill 2nd indicator, timeline-toggle hover/icon/font, vector-field overlap, hover popover overlap, theme-button overlap, stress-rating layout, self-log dock breathing room, swap layer 1↔2 expandables, energy-dynamics+phase-portrait heights, demo battery+stress placement, drain/recovery title sizes)
3. Design overhaul (reduce purple, lighten intro splash bg, button contrast, light mode toggle, larger help text, sans-serif body copy)

### Coordination

- Both agents push to `feat/mental-meter-phase-portrait` (PR #6 on elisa-lj11/psych-battery, also has `upstream` push permission and was just synced to upstream).
- Disjoint files → conflict-free rebase. Both told to `git fetch && git pull --rebase` before pushing.
- Agent B reads STATE_CONTRACT.md from Agent A for the connection-pill `status` field.

**Re-dispatch on resume:** continue via `SendMessage to:` <agent ID>. If agents are gone, re-dispatch using the prompts stored in this session transcript. Verify whether `PLAN.md` and `STATE_CONTRACT.md` already exist before re-running Phase 1 of either.

**Branch / PR:** `feat/mental-meter-phase-portrait` → PR #6 on elisa-lj11/psych-battery (auto-updates on push).

## Hardware Integration + Data-Sync Agent

- **Agent ID**: bfi07swss
- **Dispatched**: 2026-04-30
- **Branch**: feat/mental-meter-phase-portrait
- **Output log**: C:\Users\dougl\AppData\Local\Temp\claude\... asksfi07swss.output
- **Expected output files**:
  - `server.py` (updated: /heartbeat endpoint + status field in /state)
  - `charge_sender.py` (updated: PUT /heartbeat on every successful e-ink update)
  - `psych_battery_crowpanel.ino` (updated: RGB LED states on IO15/17/21)
  - `STATE_CONTRACT.md` (new: JSON contract for UI agent)
- **Re-dispatch**: `node "C:/Users/dougl/.claude/plugins/cache/openai-codex/codex/1.0.4/scripts/codex-companion.mjs" task --resume-last --write`
- **DO NOT TOUCH**: index.html (owned by parallel UI agent)

## Hardware Integration + Data-Sync Agent

- **Agent ID**: bfi07swss
- **Dispatched**: 2026-04-30
- **Branch**: feat/mental-meter-phase-portrait
- **Output log**: C:/Users/dougl/AppData/Local/Temp/claude/.../tasks/bfi07swss.output
- **Expected output files**:
  - server.py (updated: /heartbeat endpoint + status field in /state)
  - charge_sender.py (updated: PUT /heartbeat on every successful e-ink update)
  - psych_battery_crowpanel.ino (updated: RGB LED states on IO15/17/21)
  - STATE_CONTRACT.md (new: JSON contract for UI agent)
- **Re-dispatch**: node codex-companion.mjs task --resume-last --write
- **DO NOT TOUCH**: index.html (owned by parallel UI agent)

---

## Task: Phase 2 + Phase 3 UI Overhaul

- **Agent ID:** task-mon7op1h-ozebt4
- **Dispatched:** 2026-05-01
- **Expected output files:** C:/Users/dougl/psych-battery/index.html (edited in-place)
- **Commits pushed to:** upstream/main (https://github.com/elisa-lj11/psych-battery.git), branch feat/mental-meter-phase-portrait
- **Scope:** All Phase 2 items 1-14 + Phase 3 items 15-22 from PLAN.md, plus 4 STATE_CONTRACT.md required changes
- **Check progress:** /codex:status task-mon7op1h-ozebt4
- **Re-dispatch instructions:** If task is lost, re-run the same prompt from the user's session message with --resume to continue, or re-dispatch fresh with all instructions intact.

---

## Task: Deep agentic Playwright test pass (post-UI-overhaul)

- **Wrapper agent ID:** a84805c107c8e6d54 (codex:codex-rescue — COMPLETED, dispatched downstream Codex job and exited)
- **Codex job ID:** bie3c17hi (the actual long-running task)
- **Codex output file:** C:/Users/dougl/AppData/Local/Temp/claude/.../tasks/bie3c17hi.output
- **Re-dispatch / resume:** `node "C:/Users/dougl/.claude/plugins/cache/openai-codex/codex/1.0.4/scripts/codex-companion.mjs" task --resume-last --write "Continue the Playwright self-heal pass on C:/Users/dougl/psych-battery/"`
- **Dispatched:** 2026-05-01
- **Working dir:** C:/Users/dougl/psych-battery
- **Owns:** e2e/full-app.test.mjs (extends), may patch index.html for real bugs found during the run
- **Scope:** Run existing 1200-line e2e suite, triage failures from recent UI overhaul (10 listed changes — header pill hidden, source label live text, UPDATE icon, TUNE in dock not settings, dock no border, state tanks unified, model-viz-panel removed, signal filter to AW+Calendar, themes reduced to 4, layer padding-bottom 96px). Add new sections §13–§20. Loop fix→re-run until green or 5 iterations.
- **Re-dispatch:** SendMessage to a84805c107c8e6d54
- **Constraints:** No git push, no new deps, no refactor beyond minimum, hands off server.py/charge_sender/.ino files

---
## Agent: bfc61wz9p — Pixel art scene improvements
- **Dispatched:** 2026-05-02
- **Task:** Edit tools/gen_all_scenes.py to improve all 8 activity scenes per detailed visual critique
- **Expected output:** Updated gen_all_scenes.py; both `python tools/gen_all_scenes.py` and `python tools/patch_scenes.py` succeed
- **Output log:** C:\Users\dougl\AppData\Local\Temp\claude\C--Users-dougl-My-Drive--douglaspmcgowan-gmail-com--UC-Berkeley-Research-Claude-Research-Folder\504d357c-24ce-4e72-8b56-5e27db90b4af\tasks\bfc61wz9p.output
- **Re-dispatch:** Run codex:codex-rescue with `--resume` and "verify both commands pass and fix any remaining errors"
