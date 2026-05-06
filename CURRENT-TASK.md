# Current Task — 2026-05-06

## Goal

Polish pass: finish pending JS wiring + new UI requests from user.

## Completed this session ✅

- [x] Wire demo/live source toggle JS event handlers
- [x] Fix white corners on "Back to Battery" button (editorial theme)
- [x] Make dark mode editorial theme — CSS + JS wired into picker
- [x] Add editorial-dark swatch to main theme picker (removed pixel-art swatches from picker)
- [x] Shelve pixel-art themes (arcade, pastel, acrylic) into ? menu "about" tab section
- [x] When on pixel-art theme, mode toggle → LIGHT
- [x] ? menu fully opaque in demo mode (body.is-demo background: var(--px-bg))
- [x] Demo timeline: 8AM–10PM only
- [x] Batteries LEFT of timeline, same height (demo-state-row flex layout)
- [x] No green dots bottom-left in demo
- [x] Back button top-left during demo (conditional in demo-topbar)
- [x] Fix demo dropdown hover text visibility
- [x] Replace upper-left "Mental Meter" text with logo (24,911 char base64 embed)
- [x] Source toggle CSS: pill shape + correct hover in editorial/editorial-dark

## Remaining

- [ ] Playwright results (running) — fix any failures
- [ ] Commit + push to `elisa-lj11/psych-battery` main
- [ ] `vercel deploy --prod`

## Key file locations

| File         | Notes                           |
| ------------ | ------------------------------- |
| `index.html` | ~17,500 lines — entire frontend |
| `server.py`  | Port 3131, running              |

## Git status

Current branch: `feat/mental-meter-polish`
Target: merge to `elisa-lj11/psych-battery` main
