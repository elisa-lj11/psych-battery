# Google Calendar API Setup

The scorer script reads your Google Calendar to detect meetings and compute drain.
Credentials live in `~/.config/psych-battery/` — never in the repo.

---

## Step 1 — Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Click the project dropdown (top-left) → **New Project**
3. Name it `psych-battery` → **Create**
4. Make sure the new project is selected in the dropdown

---

## Step 2 — Enable the Google Calendar API

1. In the left sidebar: **APIs & Services → Library**
2. Search for **Google Calendar API**
3. Click it → **Enable**

---

## Step 3 — Create OAuth credentials

1. **APIs & Services → Credentials**
2. **+ Create Credentials → OAuth client ID**
3. If prompted to configure the consent screen first:
   - Choose **External** → **Create**
   - App name: `psych-battery`
   - User support email: your Gmail
   - Developer contact: your Gmail
   - **Save and Continue** through all screens (no scopes needed at this step)
   - On the **Test users** screen, click **+ Add users** → add your Gmail → **Save**
   - Back on the Credentials page, click **+ Create Credentials → OAuth client ID** again
4. Application type: **Desktop app**
5. Name: `psych-battery-local`
6. **Create**
7. In the dialog that appears, click **Download JSON**
8. Save the file to:
   ```
   C:\Users\<you>\.config\psych-battery\credentials.json
   ```
   (Create the folder if it doesn't exist)

---

## Step 4 — First run (one-time browser auth)

```bash
cd psych-battery/
python psych_battery_scorer.py
```

A browser tab opens. Sign in with the Google account whose calendar you want to read.
Click **Allow**. The tab closes and a `token.json` is saved next to `credentials.json`.

Subsequent runs are silent — no browser needed until the token expires (~6 months).

---

## Revoking access

Go to https://myaccount.google.com/permissions → find `psych-battery-local` → Remove.
Then delete `~/.config/psych-battery/token.json` to force re-auth on next run.
