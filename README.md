# Psych Battery

Visualizes your cognitive energy as a depleting battery based on screen activity tracked by [ActivityWatch](https://activitywatch.net/).

![battery visualization showing percentage and activity breakdown]()

## How it works

ActivityWatch runs in the background and logs which apps and windows are in focus. Psych Battery pulls that data via ActivityWatch's local API, scores each app by cognitive drain, and renders a battery that depletes over a rolling time window. AFK (idle) time recharges the battery.

## Prerequisites

- [ActivityWatch](https://activitywatch.net/downloads/) installed and running
- Python 3.x (to run the local server)

## Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/elisa-lj11/psych-battery.git
   cd psych-battery
   ```

2. Make sure ActivityWatch is running — check by opening [http://localhost:5600](http://localhost:5600) in your browser.

3. Start the local server:
   ```bash
   python server.py
   ```

4. Open [http://localhost:3131](http://localhost:3131) in your browser.

> **Why a server?** Browsers block direct requests from a web page to a different localhost port (CORS). `server.py` is a minimal proxy that forwards requests from the page to ActivityWatch — no data leaves your machine.

## Tuning drain rates

All scoring logic is in the `DRAIN_RULES` array near the top of `index.html`. Each rule matches app names and window titles (case-insensitive substring) and assigns a drain rate per minute:

| Rate | Meaning |
|------|---------|
| 3.0  | High drain (AI tools, video calls) |
| 2.0–2.5 | Medium-high (messaging, social media, email) |
| 1.0–1.5 | Medium (coding, browser, documents) |
| 0.3–0.5 | Low (music, video, system tools) |

Edit the patterns or rates to match your own usage — for example, to make a specific website count as high-drain, add its domain to the Social Media or Browser rule.

AFK recharge rate is set by `RECHARGE_RATE` (default `0.5` units/min).

## Rolling window

Use the **Window** dropdown in the UI to adjust how far back the battery looks (1, 2, 4, or 8 hours). The battery auto-refreshes every 60 seconds.

## Browser extension (optional)

Install the [ActivityWatch browser extension](https://activitywatch.net/docs/watchers.html#web-watchers) to log URLs alongside app names. Without it, all browser activity is classified as **Browser** regardless of which site you're on. With it, specific domains (e.g. reddit.com, twitter.com) can match more specific drain rules.
