# Day Timeline — Future Build Plan

Not built yet. Drops in on top of demo mode once the single-activity animation works. Purpose: let demo viewers see a whole-day narrative arc after 5–6 activity picks, without needing any explanation or real-world time to pass.

## Where it lives

Demo mode, persistent strip across the bottom of the demo view, ~60px tall. Always visible while demo mode is on; hidden with the rest of demo UI on exit.

## Visual layout

```
┌──────────────────────────────────────────────────────────────┐
│ 6am   9am   12pm   3pm   6pm   9pm   12am   3am             │
│  ╭───╮                                                       │
│  │🍳 │       📹        💬💬       💻🌙                        │  ← activity icons drop here at simClock
│  ╰───╯                                                       │
│  ╲                                                           │
│   ╲───╱╲──────╱╲─────╱╲─                                    │  ← battery % line curves through the day
└──────────────────────────────────────────────────────────────┘
```

- **X axis**: simulated clock, 6am → 6am next day (24h window). Tick labels every 3h.
- **Y axis**: battery percentage, 0–100.
- **Line**: SVG polyline drawn through `(timestamp, batteryPct)` pairs. Redraws after each activity.
- **Icons**: small pixel-art glyphs dropped at the `simClock` x-position at activity-completion time. Same glyph as the activity card.
- **Color**: line segments tinted per interval — green for net-gain, amber/red for net-drain.

## State

```js
APP.demo.timeline = {
  startedAt: '2026-04-24T06:00:00',   // simulated day-start
  events: [
    { id: 'eat_food', t: '2026-04-24T06:30', batteryAfter: 72, kind: 'recovery' },
    { id: 'zoom_meeting', t: '2026-04-24T08:00', batteryAfter: 65, kind: 'drain' },
    // ...
  ],
  batteryLine: [ [iso, pct], [iso, pct], ... ]  // dense points for smooth curve
};
```

On demo enter: `simClock = 2026-04-24T06:00:00`, `events = []`, seed `batteryLine` with starting E.
On activity complete: advance `simClock` by `activity.durationMin`, push event, append new `batteryAfter` point.

## Skip-time button

Between activities, the user may want time to pass without picking something. Button: **"Skip 2 hours →"** (or 30min / 1h / 4h dropdown).

When skipped:
1. Advance `simClock` by the skip amount.
2. Apply idle drain + circadian effect via the same model math the real app uses (`computeERest` at new wall-clock time, small passive drain on E).
3. Append interpolated points to `batteryLine` so the curve shows the natural drift.
4. No icon on the timeline for skipped time — only activity picks get icons.

## Reset / new day

- **Reset button** next to skip-time: clears timeline, resets `simClock` to 6am, resets E/S to seed values, clears accumulated features.
- **Auto-wrap at 6am next day**: if `simClock` crosses the 24h boundary, either (a) auto-reset with a "Day 2" banner, or (b) stop advancing and gray out activity cards until user resets. Pick (a) — keeps the demo flowing.

## Integration points

The timeline reads from state already being built by the single-activity animation:

- `APP.demo.E`, `APP.demo.S` → current battery %.
- `APP.demo.simClock` → where to drop the next icon.
- `APP.demo.featureAccum` → for future "show which features drove the drain" hover tooltips.

No new model calls. No new backend endpoints. Pure presentation layer on top of existing demo state.

## Hover/tap interactions (nice-to-have, defer)

- Tap an icon → modal with that activity's scripted delta + model outputs at the time of pick.
- Hover the battery line between icons → tooltip with (timestamp, battery%, primary drain feature).

## Build order when resumed

1. Scaffold: add the 60px bottom strip to the demo view. Just axis + ticks, no data.
2. Wire `APP.demo.timeline.events` — push on activity complete, render icons at correct x.
3. Draw the battery polyline.
4. Add skip-time button with idle-drain math.
5. Add reset button and day-wrap.
6. (Optional) hover tooltips and tap-for-detail modals.

Estimated scope: ~200–300 lines added to `index.html`. Can be done in one sitting after the single-activity demo ships.

## Why this plan exists

Writing this up now so the demo-mode first draft doesn't accidentally lock out the timeline later. Key decision: `APP.demo.simClock` + `APP.demo.featureAccum` need to exist from day one — the timeline is just a reader of that state, not a separate system.
