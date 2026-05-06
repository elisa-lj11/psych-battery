# Codex Reliability Issues — psych-battery project

Diagnostic log for all Codex agent failures in this project. Each incident records what was dispatched, what actually happened, why it failed, and what would have made it work. Use this to decide: should we use Codex at all for this project, and if so, how?

---

## Incident 1 — UI/UX overhaul (dispatched 2026-05-01, agent `a70fd8ee9f9f08d7e`)

### What was asked

Full Phase 2 + Phase 3 UI overhaul of `index.html` (~14k lines): 22 items from PLAN.md, 4 STATE_CONTRACT.md integration points. Broad scope: bug fixes, layout, design, signal-breakdown filter, circadian overlay, demo sync.

### What happened

- Codex ran and committed. Commits landed on `feat/mental-meter-phase-portrait`.
- **Multiple items silently not done or done wrong.** The signal-breakdown filter (AW+Calendar only) was done incorrectly multiple times — features that required wearables/sleep trackers/GPS remained in the list. User called this out explicitly 3+ times across sessions.
- The UI overhaul introduced layout regressions (mismatched state tanks, dead vertical space in Energy tank, stale Energy Dynamics redundant card) that required manual diagnosis.
- The test suite the overhaul was supposed to be verified against didn't exist yet — Codex had no way to self-verify.

### Root causes

- **Scope too broad.** 22 items across design, data, JS, CSS in a single-file 14k-line HTML blob is too much for one Codex context.
- **No test harness.** Without `node e2e/full-app.test.mjs` to run, Codex had no feedback loop. It committed based on code inspection alone.
- **Signal-breakdown filter required semantic judgment** (what counts as "ActivityWatch only") that got lost in re-summarization. Each re-dispatch inherited a degraded version of the constraint.
- **Single-file app is hard for Codex** — all CSS/HTML/JS in one file means context is consumed just loading the file, leaving little room for reasoning.

### What would have fixed it

- Scope per dispatch: max 5–7 items.
- Provide a test the agent can run (`node e2e/full-app.test.mjs`) and require it to pass before committing.
- For the signal filter: give an explicit allowlist file (e.g. `SIGNALS.md`) rather than a natural-language constraint.

---

## Incident 2 — Hardware sync agent (dispatched 2026-04-30, agent `bfi07swss`)

### What was asked

Server-side: add `/heartbeat` endpoint, `status` field to `/state`, RGB LED states for e-ink hardware, `STATE_CONTRACT.md`.

### What happened

- Agent produced output (committed some files).
- The `STATE_CONTRACT.md` it wrote was consumed by the UI agent, which then used it for demo-state sync.
- **Demo→e-ink sync was never fully wired.** The `PUT /demo-state` and `DELETE /demo-state` endpoints referenced in STATE_CONTRACT.md didn't end up in `server.py` in a usable form. The test suite marks this as "informational" (tolerated non-fatal).
- **LED states not confirmed working** — no hardware test in the loop, no CI for firmware.

### Root causes

- Hardware agent and UI agent were parallel but STATE_CONTRACT.md was a hard dependency. Timing wasn't enforced.
- No way to test e-ink hardware in headless CI.
- Firmware changes (`.ino` file) can't be verified without flashing the board.

### What would have fixed it

- Sequential dispatch: hardware agent first → wait for STATE_CONTRACT.md → then UI agent.
- Write STATE_CONTRACT.md as a spec-first artifact before dispatching either agent.
- Add a `server.py` test (`pytest` or even `curl` smoke test) that Codex can run to confirm endpoints exist.

---

## Incident 3 — Deep Playwright agentic test pass (dispatched 2026-05-01, agents `a84805c107c8e6d54` + `bie3c17hi`)

### What was asked

Extend `e2e/full-app.test.mjs` with §13–§20 covering recent UI changes, run iteratively until green, self-heal failures.

### What happened

- **Codex-rescue subagent completed in ~11 minutes but handed off to a nested Codex job** (`bie3c17hi`) instead of doing the work itself.
- Nested Codex job `bie3c17hi` ran for ~a few minutes, left 140 lines of log, then stopped.
- **Zero changes were made to any file.** Working tree identical before and after.
- The subagent's `<status>completed</status>` notification was technically accurate (wrapper done) but misleading — the actual work never finished.
- The test suite was then **run manually** and produced **127/127 PASS** on the first try — no Codex help needed.

### Root causes

- **codex:codex-rescue wraps a Codex job and exits without waiting.** The wrapper is not a "run and wait" harness — it dispatches and reports immediately. The nested job runs in an opaque subprocess.
- **No output feedback loop.** The nested Codex job can't communicate "I'm done" back to the wrapper; the wrapper has already exited.
- The Codex job itself stopped mid-run (likely hit token/step limit or errored silently) with no recoverable artifact.
- **The task didn't need Codex.** Extending a 1200-line ESM test file with 8 new sections is ~200 lines of mechanical JS — well within what Claude can do directly without delegation.

### What would have fixed it

- Run the test pass directly (`node e2e/full-app.test.mjs`) instead of delegating.
- If delegating: use `codex:codex-rescue` **only** for substantial file-writing tasks (>200 lines new code, complex multi-file rewrites) not test runs.
- If a task can be verified by a shell command, do it yourself with Bash.

---

## Incident 4 — Ingest infrastructure (dispatched 2026-05-04, agent `a99ebdeafb3fc2954`)

### What was asked

Build 4 new files for `ai-engineering-design-db`: `ingest.html` (~400 lines), `api/ingest.js` (~200 lines, OpenAI API + GitHub API), `.github/workflows/rebuild.yml` (~55 lines), `scripts/embedding-report.py` (~130 lines). All new files, clear verifier, 4 items — technically within the dispatch rules.

### What happened

- **Agent stalled for 600s with zero progress.** Stream watchdog killed it.
- The agent's own last message: _"The issue is clear — bash is the problem with all quoting. The solution is to use the Write tool to create a .js file, then execute it."_
- **Zero file changes.** Claude wrote all 4 files directly in ~8 minutes.

### Root cause

**Bash quoting hell on Windows for complex JS.** `api/ingest.js` contains multi-line template strings, nested JSON, backtick-heavy patterns, and special characters that are impossible to write via `echo` or heredoc in PowerShell/CMD without escaping every character. The agent got stuck in a loop of failed bash attempts trying to create the file and eventually hit the 600s stream watchdog.

This is a **Windows-specific failure mode** not covered by the existing rules. On Linux, `cat << 'EOF'` heredocs handle complex JS cleanly. On Windows, PowerShell heredocs (`@'...'@`) require different syntax, and CMD `echo` can't write multi-line content at all without fragile escaping.

### Why Claude dispatched to Codex anyway

The task matched all "OK to dispatch" criteria:

- 4 items (≤5 limit)
- Each file >200 lines
- Clear verifier: `node -e "require('./api/ingest.js')"` + page load
- New files, not modifying a 5k+ single-file app

The existing rules didn't cover "complex JS/JSON file creation on Windows."

### What would have fixed it

Just doing it in Claude directly. There was no good reason to delegate — it was new files from scratch with a known spec. Codex adds value when it needs to _discover_ what to write (e.g. tracking down a bug). When the spec is fully known and the output is deterministic, Claude is faster.

**New rule added below.**

---

## Pattern diagnosis

| Pattern                                            | What goes wrong                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| Single-file app too large for one dispatch         | Codex spends most of context just loading the file                 |
| No runnable verification (test/curl/lint)          | Codex commits based on code inspection alone, misses regressions   |
| Scope > 5-7 discrete items                         | Later items are done shallowly or skipped silently                 |
| Natural-language constraints that require judgment | Re-summarization degrades the constraint across sessions           |
| `codex:codex-rescue` for mechanical tasks          | Wrapper exits before work is done; no feedback channel back        |
| Parallel agents with shared output files           | Race condition or ordering dependency silently breaks the contract |
| Complex JS/JSON file creation on Windows           | Bash quoting hell → agent loops → 600s stream watchdog kills it    |

---

## Recommendations for future Codex use in this project

1. **Max 5 items per dispatch.** Use multiple sequential dispatches rather than one broad one.
2. **Always include a runnable verifier.** Give Codex a command it can run to confirm success: `node e2e/full-app.test.mjs`, `python -m pytest server_test.py`, `curl localhost:3131/state | jq '.status'`. Require it to paste the output.
3. **Pre-write constraint files.** For filter/allowlist constraints (signal breakdown, theme list, feature flags), write a dedicated file (`SIGNALS.md`, `THEMES.md`) that Codex reads as a hard spec. Don't embed constraints in the prompt alone.
4. **Don't use Codex for test runs or sub-200-line mechanical work.** Use Bash directly.
5. **On Windows: don't use Codex to write new files with complex string content** (multi-line JS, nested JSON, template literals, backticks). Bash heredocs don't work reliably in PowerShell/CMD. Use Claude's Write tool directly — it's faster and doesn't have the quoting problem.
6. **For hardware tasks**: spec the contract (`STATE_CONTRACT.md`) before dispatching any agent, not as an output of the hardware agent.
7. **Sequential over parallel** when agents share output files. Parallel is only safe when file ownership is truly disjoint.
8. **Don't trust `<status>completed</status>` from codex-rescue wrapper.** Always check: did the working tree change? Did the expected output file exist and update?

---

## Quick-reference agent IDs

| Agent                     | ID                     | Status              | Outcome                                     |
| ------------------------- | ---------------------- | ------------------- | ------------------------------------------- |
| Full audit                | `task-mojl1ocx-bsbhed` | Done                | Report delivered                            |
| Hardware sync v1 (killed) | `a321571a308847dea`    | Killed              | None                                        |
| Hardware sync v2          | `bfi07swss`            | Done                | Partial — no demo-state endpoints           |
| UI overhaul               | `a70fd8ee9f9f08d7e`    | Done                | Partial — regressions, signal filter broken |
| Phase 2+3 rebuild         | `task-mon7op1h-ozebt4` | Done                | Delivered but needed heavy manual cleanup   |
| Playwright wrapper        | `a84805c107c8e6d54`    | Done (wrapper only) | Dispatched nested job, exited               |
| Playwright nested         | `bie3c17hi`            | Abandoned           | 140 log lines, zero file changes            |
| Ingest infra (ai-eng-db)  | `a99ebdeafb3fc2954`    | Stalled / killed    | 600s watchdog; bash quoting on Windows      |
