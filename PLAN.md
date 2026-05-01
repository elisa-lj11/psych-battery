# Mental Meter Overhaul Plan

Date: 2026-05-01
Repo: `C:\Users\dougl\psych-battery`
Branch: `feat/mental-meter-phase-portrait`
Primary file: `index.html`

## Scope guardrails

- Edit only `index.html` in Phases 2 and 3. `PLAN.md` is the only additional repo file for this pass.
- Do not touch `psych_battery_crowpanel.ino`, `charge_sender.py`, or `server.py`.
- Keep all new visual tokens behind CSS custom properties. Do not hardcode new colors into downstream rules.
- Treat older memory line numbers as stale; the live `index.html` is currently 13,495 lines.

## Current assumptions

- `STATE_CONTRACT.md` is present in this checkout and confirms `GET /state` includes `status: "live" | "stale" | "offline"` plus `source`, and that interactive demo mode should mirror its synthetic payload through `PUT /demo-state` / `DELETE /demo-state`.
- `python server.py` is running locally on port `3131` for screenshot verification.
- If the live backend omits any optional display-write metadata beyond `status`, the browser UI will still consume the required contract literally and degrade gracefully.

## Phase 1 baseline artifacts

Baseline screenshots were captured to:
`C:\Users\dougl\AppData\Local\Temp\psych-battery-phase1-2026-05-01`

Captured files:

- `layer0_arcade_mobile.png`
- `layer0_gameboy_mobile.png`
- `layer0_amber_mobile.png`
- `layer0_phosphor_mobile.png`
- `connection_pill_popover_desktop.png`
- `layer1_mobile.png`
- `layer2_desktop.png`
- `demo_mode_mobile.png`
- `recovery_menu_mobile.png`
- `help_sheet_desktop.png`
- `intro_splash_mobile.png`
- `first_visit_banner_mobile.png`
- `rating_energy_mobile.png`
- `rating_stress_mobile.png`

## Reference patterns to apply

1. Linear
Region outside repo: official home + display-options docs
Why it matters: Linear emphasizes speed, reduced noise, dense controls, sticky grouping context, and the option to hide empty groups. I will borrow its "show only useful rows", compact segmented controls, and status-first hierarchy rather than copying its exact visuals.

2. Vercel
Region outside repo: current dashboard docs + 2026 navigation rollout notes
Why it matters: Vercel's dashboard reinforces a clear top-level scope, fast find/toggle affordances, unified tabs, card/list switching, and mobile-aware navigation. I will use that pattern for clearer header controls, stronger control grouping, and less accidental overlap between chrome and content.

3. Notion
Region outside repo: Notion-for-product + product-management pages
Why it matters: Notion keeps context next to the work, uses quieter surfaces, and favors readable sans-serif body copy over stylized display fonts for explanatory text. I will apply that to help text, glossary text, tooltips, and other descriptive UI copy.

4. PICO-8 / fantasy-console discipline
Region outside repo: official PICO-8 manual + FAQ
Why it matters: PICO-8's fixed palette, crisp pixel constraints, and small-screen legibility are the right model for keeping this UI pixel-forward without making it muddy. I will use a tighter token palette, harder border contrast, and simpler color roles instead of stacking purple-on-purple surfaces.

## Verification harness

- After every edit phase: extract the inline script and run `node --check` on it.
- After every edit phase: run `git diff --check`.
- Before each push: `git fetch origin` then `git pull --rebase origin feat/mental-meter-phase-portrait`.
- After Phase 2: screenshot every fixed surface in live mode and demo mode.
- After Phase 3: full screenshot pass of all major surfaces in all themes, including the new light mode.

## Itemized implementation plan

### Phase 2

1. Recovery menu exit button
Region: `index.html:3552-3608`, `7355-7376`, `13409-13419`
Change: ensure the recovery sheet always exposes a clearly visible close/back affordance, and make its styling survive the current sheet/layout stack instead of relying on a subtle corner close.
Verify: open the recovery sheet, exit without selecting anything, and confirm return to normal mode with no stuck backdrop or state.
Dependencies: none.

2. Demo mode timeline bounce-scroll reset
Region: `index.html:767-792`, `2002-2025`, `10468-10715`, `13287-13318`
Change: diagnose which demo rerender path is resetting scroll position, then preserve or isolate the scroll container so the timeline/menu does not jump back to the top during idle rerenders or mode toggles.
Verify: enter demo mode, scroll the demo surface, wait through rerenders and window-mode toggles, and confirm the scroll position stays stable.
Dependencies: none.

3. Hide missing Layer feature rows instead of greying them out
Region: `index.html:9151-9175`, `9893-9907`, `11457-11524`, `11979-12002`
Change: distinguish missing feature values from populated zeroes, then filter out missing drain/recovery rows entirely in the feature lists and diagnostics lists instead of rendering grey placeholder rows.
Verify: inspect the feature lists in both live/offline and demo states and confirm only actually populated metrics render.
Dependencies: item 11, because the feature lists move to the second expandable layer.

4. Add second connection-pill indicator for e-ink/LED write status
Region: `index.html:116-221`, `6438-6476`, `7652-7660`, `12009-12103`, `13000-13041`
Change: extend the connection-pill markup and state updater so it can show both app connectivity and display-write status, with green/amber/red mapping for `live`/`stale`/`offline` and hover text describing the second indicator.
Verify: force or simulate each status state, then confirm the second indicator color, label text, and ARIA/title copy update correctly.
Dependencies: `payload.status` contract assumption from `/state`.

5. Upgrade the `4H/2M` timeline toggle
Region: `index.html:463-511`, `6325-6330`, `9640-9664`, `13810-13827`
Change: give the header toggle the same font and weight treatment as the rest of the top-row chrome, add a refresh/cycle icon, and expand the tooltip text so each mode explains the 4-hour live window vs. 2-minute accelerated demo window.
Verify: hover/focus the control in both states and confirm label, icon, font, and tooltip copy are all correct.
Dependencies: none.

6. Stop the phase-portrait plot from colliding with its explanatory text
Region: `index.html:5398-5590`, `6660-6706`, `11133-11455`
Change: separate plot height, legend flow, and caption spacing so the phase-portrait visualization owns a fixed plot area and the explanatory copy sits fully outside it.
Verify: desktop and mobile diagnostics screenshots show the plot, axes, legend, and caption as separate non-overlapping blocks.
Dependencies: item 11, because the diagnostics surface becomes Layer 1.

7. Reposition the live-data hover popover so it stops covering neighboring text
Region: `index.html:116-221`, `6438-6476`, `12009-12103`
Change: adjust the connection-pill popover anchor, width, and stacking so the hover panel clears adjacent header text and remains readable at desktop and narrow widths.
Verify: hover/focus the connection pill near other header controls and confirm no overlap or clipping.
Dependencies: item 4, because the same component gets rebuilt there.

8. Fix the recovery-screen theme button overlap
Region: `index.html:4231-4299`, `6258-6266`, `7355-7376`
Change: remove the current mobile overlap between the floating theme picker and recovery-sheet explanatory copy, likely by changing recovery-mode chrome placement rather than squeezing the sheet text.
Verify: open the recovery sheet on mobile width and confirm the theme control no longer overlaps subtitle text or activity rows.
Dependencies: none.

9. Rework the stress rating sheet layout
Region: `index.html:3644-3669`, `7324-7351`, `12275-12290`, `13433-13452`
Change: move the stress descriptor copy into a right-side companion block aligned with the numeric rail, matching the stronger two-column feel already implied by the energy layout.
Verify: open the stress tab and confirm the 1-10 scale and descriptor copy sit side-by-side on larger widths without collapsing the tap targets.
Dependencies: none.

10. Narrow and center the self-log dock
Region: `index.html:3492-3518`, `6757-6768`
Change: convert the fixed dock from edge-to-edge to a centered tray with max width, outer breathing room, and better separation from the viewport edges.
Verify: mobile screenshots show equal left/right margins and centered dock controls.
Dependencies: none.

11. Swap Layer 1 and Layer 2 responsibilities
Region: `index.html:6507-6719`, `11457-11873`, `12268-12270`, `13349-13360`, `13939-14110`
Change: make the first battery expansion open full diagnostics (Model B + D, state tanks, energy dynamics, phase portrait), and move the drain/recovery feature lists to the second expandable layer. Update the button text, hints, onboarding text, and help/tour copy to match the new order.
Verify: tap once from Layer 0 and confirm diagnostics appear; trigger the second layer and confirm feature lists live there instead.
Dependencies: none. This is the structural Phase 2 foundation and should land early.

12. Give energy dynamics + phase portrait more vertical and horizontal room
Region: `index.html:5398-5430`, `5619-5815`, `6658-6706`
Change: rebalance the diagnostics row away from the current `3/2` split and `340px` floor, increase min-height, and make both children stretch to the new row height so the chart and portrait stop feeling compressed.
Verify: diagnostics screenshots show both cards taller, with no clipped labels or squashed internals.
Dependencies: item 11.

13. Put demo battery + stress on the same bottom row as the timeline
Region: `index.html:2002-2025`, `5955-6137`, `10489-10708`
Change: restructure the demo bottom strip so the battery/stress pair and the timeline feel like one coordinated bottom dialog instead of stacked fragments, while keeping spacing even across mobile widths.
Verify: demo screenshots show the pair and timeline aligned within one bottom composition with balanced spacing.
Dependencies: none.

14. Increase drain/recovery section-title size
Region: `index.html:108-110`, `5279-5281`, `6533-6541`
Change: selectively increase title scale for the drain/recovery feature cards without inflating every section title in the app.
Verify: the feature-card headings are visibly larger than baseline while still matching the pixel UI.
Dependencies: item 11.

### Phase 3

15. Reduce purple dominance with semantic color roles
Region: `index.html:17-40`, `4121-4215`, `4449-4514`, `3552-3571`
Change: introduce clearer semantic tokens for energy, stress, recovery, surface, panel, and control layers so purple remains the accent but stops dominating backgrounds and passive surfaces.
Verify: compare all theme screenshots and confirm purple is mostly reserved for accent/focus states while energy uses green, stress uses red/orange, and recovery leans cool blue.
Dependencies: none. This is the Phase 3 foundation.

16. Lighten the purple behind the intro-splash icon
Region: `index.html:2436-2550`, `7064-7126`
Change: reduce the icon-panel saturation and/or lighten the icon background token so the intro splash starts from a cleaner, less heavy first impression.
Verify: intro splash screenshot shows the icon background lighter than the current baseline without losing contrast.
Dependencies: item 15.

17. Increase contrast between menu/button surfaces and their surrounding panels
Region: `index.html:2450-2537`, `3552-3571`, `4236-4329`, `4449-4514`, `4565-4792`
Change: split panel and control surfaces into more distinct token layers so menus, sheets, and popovers read as containers while buttons still pop above them.
Verify: help, recovery, rating, and intro screenshots show clear panel-vs-button separation.
Dependencies: item 15.

18. Add a persisted light mode as a fifth theme
Region: `index.html:4121-4215`, `4231-4329`, `6352-6428`, `13148-13190`
Change: add a fifth token set for light mode, wire it into the existing theme persistence, and add a sun/moon control in the header that can switch to and from the light theme without disturbing the four dark themes.
Verify: toggle light mode, reload, confirm persistence in localStorage, and confirm the theme picker/header both reflect the active light theme.
Dependencies: item 15.

19. Make buttons pop harder across the UI
Region: `index.html:4475-4514`, `4784-4805`, `845-858`, `1028-1058`, `3588-3608`
Change: strengthen border contrast, fill contrast, and shadow depth for high-priority buttons and key controls so they stand off from the surrounding interface instead of blending into the same purple plane.
Verify: screenshots across header, sheets, demo, and help show clearly elevated button affordances.
Dependencies: items 15 and 17.

20. Increase help-panel body text size
Region: `index.html:4565-4739`, `6216-6241`, `6770-7054`
Change: bump readable body sizes and line-height across all help tabs while leaving section labels and tab chrome in the pixel font.
Verify: review the About, Shortcuts, Glossary, and How it Works panels and confirm paragraph text is larger and more readable.
Dependencies: none.

21. Use sans-serif for explanatory copy, keep Silkscreen for labels/headings
Region: `index.html:138-221`, `2296-2319`, `4595-4716`, `5199-5228`, `5479-5498`, `5567-5572`
Change: add a dedicated copy-font token (system UI stack) and apply it to help text, glossary descriptions, tooltips, jargon-tip popovers, connection-pill popovers, diagnostics popovers, and other explanatory paragraphs while leaving button text, section titles, and headings in Silkscreen.
Verify: inspect CSS/DOM and screenshots to confirm body copy switches to sans-serif while labels and headings remain pixel-styled.
Dependencies: item 15.

22. Rebalance text and color hierarchy using the reference patterns above
Region: `index.html:24-40`, `4121-4215`, `4381-4805`, `5955-6241`, `2435-2695`
Change: use the Linear/Vercel/Notion/PICO-8 reference mix to tighten spacing, reduce noisy chroma, raise muted-text contrast, and keep explanatory copy closer to its associated control without overwhelming the pixel UI.
Verify: final all-surface, all-theme screenshot pass should show a calmer neutral canvas, stronger semantic colors, clearer copy hierarchy, and no return of the current purple-on-purple muddiness.
Dependencies: items 15-21.

## Execution order

Phase 2 recommended order:

1. Item 11 (layer swap)
2. Items 3, 6, 12, 14 (surfaces affected by the swap)
3. Items 1, 2, 4, 5, 7, 8, 9, 10, 13

Phase 3 recommended order:

1. Item 15 (token foundation)
2. Items 16, 17, 18, 19, 20, 21
3. Item 22 (global balancing pass)
