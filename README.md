# Psych Battery

Psych Battery is a UC Berkeley research app that visualizes a user's mental energy as a pixel-art battery. The frontend is a single-file vanilla JS app (`index.html`, no build step, no npm). The backend is a Python Flask server (in the `dpm-research-hub` repo) that runs a two-compartment ODE model tracking energy and stress across the day, fed by real-time data from ActivityWatch, Slack, Google Calendar, Zoom, Todoist, Apple Health, and more.

---

## Demo mode (zero setup)

Start the proxy server and open the app in your browser:

```bash
cd psych-battery-app/
python server.py
# then open http://localhost:3131
```

Select a synthetic profile from the dropdown: **Sam**, **Maya**, **Alex**, or **Jordan**. All features work offline in demo mode — no Flask backend or ActivityWatch required.

---

## Full mode

Full mode requires two additional services running alongside the proxy server:

1. **ActivityWatch** (localhost:5600) — passive activity tracker; download from [activitywatch.net](https://activitywatch.net/)
2. **Flask backend** (localhost:7070) — ODE model + integrations; from the `dpm-research-hub` repo

---

## Setup

### Quick start (Mac/Linux)

```bash
bash run-local.sh
```

### Quick start (Windows)

```bat
run-local.bat
```

These scripts start both background servers and open the browser automatically. Pass `--dpm-hub PATH` (Mac/Linux) or the path as the first argument (Windows) if your `dpm-research-hub` clone is not a sibling directory.

### Manual setup

**1. Clone both repos as sibling directories:**

```bash
git clone https://github.com/douglaspmcgowan/psych-battery psych-battery-app
git clone https://github.com/douglaspmcgowan/dpm-research-hub dpm-research-hub
```

**2. Install Python dependencies** (only the backend needs them):

```bash
cd dpm-research-hub && pip install -r integrations/requirements.txt
```

`psych-battery-app` only uses Python stdlib — no install needed.

**3. Download and start ActivityWatch** from [activitywatch.net](https://activitywatch.net/)

**4. Start the Flask backend** (from `dpm-research-hub/`):

```bash
python -m integrations.models.main
```

**5. Start the proxy server** (from `psych-battery-app/`):

```bash
python server.py
```

**6. Open** http://localhost:3131

---

## Features

### Layer system

| Layer | How to reach | What you see |
|-------|-------------|--------------|
| **Layer 0** | Default view | Large pixel-art battery SVG, energy percentage, 4 color themes (Arcade / GameBoy / Amber / Phosphor) |
| **Layer 1** | Tap the battery | Drain-pressure bar (12 pixel segments), drain vs recovery feature rows with mini-bars and tone-coded hints |
| **Layer 2** | Tap "Show full diagnostics" | Circadian model chart (SVG), pixel E + S state tanks |

### Self-log dock

Rate your current Energy and Stress on a 1–10 scale. Ratings are POSTed to `/log` on the Flask backend and folded into the ODE model at the next tick.

### Recovery modes

Log a recovery session instantly (one-shot), or toggle a persistent recovery banner that stays active until you tap **END**.

### Screensaver

Full-screen ambient animation matched to your current activity: breath, exercise, music, nap, and more.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `E` | Log energy |
| `S` | Log stress |
| `R` | Start recovery |
| `D` | Toggle diagnostics |
| `?` | Show help overlay |

---

## Architecture

```
Browser (http://localhost:3131)
  ├── GET /aw/*  →  server.py (proxy)  →  ActivityWatch (localhost:5600)
  ├── GET http://localhost:7070/state  →  Flask backend (direct, CORS allowed)
  └── POST http://localhost:7070/log   →  Flask backend (direct, CORS allowed)

Flask backend (dpm-research-hub repo)
  ├── Every 5 min: polls AW, Slack, GCal, Zoom, Todoist, Apple Health, Keystrokes, Proximity
  ├── Ticks Model B (E + S ODE) and Model D (circadian baseline)
  └── Writes state to ~/.psych-battery/state.json
```

`server.py` is a minimal Python HTTP server that serves `index.html` and proxies ActivityWatch requests to avoid CORS issues. The Flask backend is a separate process that the browser hits directly (CORS is enabled on all `/state` and `/log` routes).

---

## Flask backend credentials

Create `~/.psych-battery/secrets.env` with any credentials you have. Each integration degrades gracefully if its credential is missing — you can run with any subset and the rest of the model still works.

```bash
SLACK_USER_TOKEN=xoxp-...
TODOIST_API_TOKEN=...
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
OPENAI_API_KEY_HADM=sk-...
```

The Flask backend sources this file on startup. If a credential is missing, that integration logs a warning and returns zeros for its feature contributions.

---

## Health check

```bash
python check-health.py
```

Prints the status of both servers, active integrations, feature-group summaries, and a final count of active vs. total features. Exits 0 if both servers responded, 1 otherwise.

---

## CrowPanel (e-ink display)

The repo also contains firmware for a **Good Display 5.79" e-ink panel** (CrowPanel) that renders the battery on physical hardware, giving you a desk widget that updates every few minutes. See [crowpanel/CROWPANEL_SETUP.md](crowpanel/CROWPANEL_SETUP.md) for wiring, flashing, and calibration instructions.
