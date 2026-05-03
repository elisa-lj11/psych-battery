# Current Task

## Goal

Fix live-data diagnostics + several UI improvements

## Items (verbatim from user)

1. **Live data features not showing** — drain and recovery feature bars are all empty/0 in live data mode (NOT demo). Demo features work fine (different code path).
2. **Circadian graph lines** — draw lines connecting E and S data points on the timeline graph
3. **Open circle for current point** — the "now" data point on the circadian/timeline graph should be an open circle so it's visually distinct
4. **Remove jargon** — "Model B + D" and similar technical labels → rename to plain English that a non-technical user understands
5. **Animation planning (carry-over)** — research and plan each activity animation more intentionally (motion should match what the activity realistically looks like)

## Completed this session (before this task)

- 2-column layout when activity open (scene left, all info right)
- Timeline widened to fill column width (width: 100%)
- Battery pair horizontal layout
- demo-rb-pipe (pipeline content in right bar)

## Remaining steps

1. Investigate live-data feature bar rendering (read layer2 diagnostics code + /state JSON)
2. Fix live features (likely key mismatch or render bug)
3. Add line segments to circadian/timeline graph
4. Change current point to open circle
5. Find + rename "Model B + D" and other jargon
6. Plan animations per activity (separate pass)

## Verifier

- Live mode: open Layer 2, check feature bars show non-zero values when AW is running
- Timeline: see connected line through E and S points
- Jargon: "Model B + D" text gone from all visible UI
