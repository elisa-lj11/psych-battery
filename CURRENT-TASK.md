# Current Task — 2026-05-05

## Goal

Multi-fix polish pass + push to Elisa's main + Vercel deploy.

## Items (in order)

### CSS / text fixes (in index.html)

- [x] .avg-row 0.88→1rem, .avg-values 0.82→0.95rem (done)
- [ ] Phase portrait axis ticks 9px→11px, E/S labels 10px→12px
- [ ] Circadian 100%/0% labels 11px→13px
- [ ] .layer2-tank-title 0.74rem→0.82rem
- [ ] Change "live data - model ticking" → "live data" (find text in HTML)
- [ ] Remove drop shadow behind main battery numbers (editorial battery)
- [ ] Take shading off non-clickable boxes (identify + fix)
- [ ] Fix stress logging: 10/10 = HIGH stress, 1/10 = LOW stress (check if inverted)

### CrowPanel firmware (psych_battery_crowpanel.ino)

- [ ] Remove 100% rectangle: when trend=="flat", draw NOTHING (not the bar rect)
- [ ] After firmware change, re-flash via arduino-cli

### Website battery shape (pixel-art themes)

- [ ] Mimic editorial tall-vertical portrait battery (clip-path, terminal tip) in all non-editorial themes
  - Target themes: arcade, gameboy, amber, phosphor, pastel, acrylic, light
  - Keep pixel-art crisp aesthetic (pixelated rendering, Silkscreen font)
  - Fill from bottom, terminal nub at top

### Live server / CrowPanel sync

- [ ] Verify charge_sender.py is running / start via bridge-restart endpoint
- [ ] Ensure display updates in sync with server.py (no lag or race)
- [ ] Check OFFLINE_TIMEOUT_MS behavior

### Test everything

- [ ] Run `node e2e/editorial-full.mjs` (or screenshot pass)
- [ ] Verify CrowPanel receives charge updates

### Deploy

- [ ] Push to `elisa-lj11/psych-battery` main branch (need to check push access / open PR)
- [ ] `vercel deploy --prod`

## Key file locations

| File                                                            | Notes                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| `index.html`                                                    | ~16,800 lines — entire frontend                         |
| `server.py`                                                     | Port 3131, restart after index.html edit                |
| `crowpanel/psych_battery_crowpanel/psych_battery_crowpanel.ino` | CrowPanel firmware                                      |
| `charge_sender.py`                                              | Bridge: reads energy from server, sends over USB Serial |
| `e2e/editorial-full.mjs`                                        | Playwright test suite                                   |

## Git status

Current branch on elisa's repo: `feat/mental-meter-polish`
Target: merge/push to `elisa-lj11/psych-battery` main
