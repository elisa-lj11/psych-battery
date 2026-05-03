# Current Task

## Goal

Multi-part: fix server.py drain/recovery data, remove go_outside animation sprite, dispatch Madison-ui aesthetic Codex task, write animation plan for activity scenes

## Completed this session (prior compaction)

- Killed 3 stale server.py processes and restarted live features
- Added open circle at current E/S endpoint on demo timeline
- Renamed all jargon labels (Model D, Legacy breakdown, Phase portrait, etc.)
- Updated CLAUDE.md with CURRENT-TASK.md first-action rule
- Rebuilt all 8 activity scenes as Python-generated pixel art PNGs via gen_all_scenes.py + patch_scenes.py
- Dispatched Codex bfc61wz9p to improve scene compositions
- Found madison-ui branch on elisa-lj11 repo, analyzed aesthetic
- Pushed working version to Vercel (psych-battery.vercel.app)

## Remaining items

1. **Fix server.py**:
   - Add `after_hours_frac` computation from AW event timestamps (weekend = 1.0, weekday outside 9am-6pm = after hours)
   - Lower `focus_block_min` threshold from 25 min → 10 min
   - Restart server after

2. **Remove go_outside sprite**: Remove `anim-cloud` and `anim-sun` overlay rects from patch_scenes.py go_outside entry, re-run patch_scenes.py, commit

3. **Dispatch Codex for madison-ui aesthetic**: Full plan written and dispatched as separate worktree task

4. **Write animation plan**: Per-activity discrete animations as response text

## Verifier

- `curl http://localhost:3131/state` → `after_hours_frac` > 0 on Saturday evening
- `curl http://localhost:3131/state` → `focus_block_min` non-zero if any 10+ min focused session
- go_outside scene in app: no moving cloud or sun rect
- Server running, app interactive at http://localhost:3131
