# CURRENT-TASK

**Goal:** psych-battery UI polish — four new items from this message.

## New items (this message)

1. **Readout label rename**: "D" → "Drain", "C" → "Circ. Floor" in the 6-box variable readout. Keep section title "Circ. Floor" on circadian chart as-is.

2. **Demo profile energy data**: Populate each demo profile (sam, maya, alex, jordan) with realistic energy-over-time tick history that fits their persona, so the circadian chart and timeline are well-populated.

3. **E/S map larger + legend centered**: Make phase portrait bigger to fill available space; center the legend row below the chart.

4. **STRESS label spacing**: Currently too close to Y-axis (overcorrected) — move it slightly away, maybe x=11→14 in SVG coordinates.

5. **New pixel art**: Unique illustrations for stretch, hydrate, step_away, back_to_back, after_hours activities.

6. **Light/dark toggle in demo**: The interactive demo still needs a theme light/dark toggle.

7. **Remove E/S axis corner labels**: Remove the "E" and "S" labels from the corners of the phase diagram axes.

## Steps

1. Edit `renderLayer2` (or equivalent) readout items: label "D" → "Drain", "C" → "Circ. Floor"
2. Edit demo profile DEMO_PROFILES or equivalent data — add `tickHistory` arrays per persona
3. Adjust phase portrait CSS + legend CSS (legend centered)
4. Adjust STRESS SVG label x position from 9 to ~14
5. Remove E/S corner labels from phase diagram axes
6. Add light/dark toggle to the demo interactive mode
7. New pixel art for: stretch, hydrate, step_away, back_to_back, after_hours
8. Verify with Playwright screenshots
9. Commit + push origin/main + upstream/main

## Branch

`feat/mental-meter-polish`

## Verifier

```
cd C:/Users/dougl/psych-battery && node e2e/verify-round2.mjs
```
