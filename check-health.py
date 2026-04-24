# Usage: python check-health.py
# Checks the health of both psych-battery servers and prints a summary.
# Exits 0 if both servers responded, 1 otherwise.
# No third-party dependencies — stdlib only.

import json
import sys
import urllib.request
import urllib.error

AW_URL    = 'http://localhost:5600/api/0/info'
FLASK_URL = 'http://localhost:7070/state'

FEATURE_GROUPS = {
    'meetings': ['meeting', 'zoom', 'gcal', 'calendar'],
    'focus':    ['focus', 'keystroke', 'aw', 'active'],
    'outside':  ['outside', 'proximity', 'location'],
    'stress':   ['stress', 'slack', 'email'],
}


def fetch_json(url, timeout=4):
    """Return (data_dict, None) on success, (None, error_str) on failure."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8')), None
    except urllib.error.URLError as exc:
        return None, str(exc)
    except Exception as exc:
        return None, str(exc)


def main():
    all_ok = True

    # ------------------------------------------------------------------ #
    # ActivityWatch
    # ------------------------------------------------------------------ #
    print('=== ActivityWatch (localhost:5600) ===')
    aw_data, aw_err = fetch_json(AW_URL)
    if aw_err:
        print(f'  UNREACHABLE: {aw_err}')
        print('  Is ActivityWatch running? Download from https://activitywatch.net/')
        all_ok = False
    else:
        version  = aw_data.get('version',  'unknown')
        hostname = aw_data.get('hostname', 'unknown')
        print(f'  Status:   OK')
        print(f'  Version:  {version}')
        print(f'  Hostname: {hostname}')
    print()

    # ------------------------------------------------------------------ #
    # Flask backend
    # ------------------------------------------------------------------ #
    print('=== Flask backend (localhost:7070) ===')
    flask_data, flask_err = fetch_json(FLASK_URL)
    if flask_err:
        print(f'  UNREACHABLE: {flask_err}')
        print('  Start the Flask backend:')
        print('    cd dpm-research-hub && python -m integrations.models.main')
        all_ok = False
        print()
    else:
        # Core model state
        E_display  = flask_data.get('E_display',  flask_data.get('E',     'N/A'))
        E_internal = flask_data.get('E_internal', flask_data.get('E_raw', 'N/A'))
        S          = flask_data.get('S',           'N/A')
        last_tick  = flask_data.get('last_tick_iso', flask_data.get('last_tick', 'N/A'))

        print(f'  Status:         OK')
        print(f'  E_display:      {E_display}')
        print(f'  E_internal:     {E_internal}')
        print(f'  Stress (S):     {S}')
        print(f'  Last tick:      {last_tick}')
        print()

        # Feature breakdown
        last_feats = flask_data.get('last_feats', {})
        if not last_feats:
            print('  last_feats: not present in state response')
            print()
        else:
            total         = len(last_feats)
            active_keys   = sorted(k for k, v in last_feats.items() if float(v) != 0.0)
            inactive_keys = sorted(k for k, v in last_feats.items() if float(v) == 0.0)

            # Feature group summaries
            print('=== Feature group summaries ===')
            for group, keywords in FEATURE_GROUPS.items():
                group_val = sum(
                    float(v)
                    for k, v in last_feats.items()
                    if any(kw in k.lower() for kw in keywords)
                )
                print(f'  {group:<12}: {group_val:.4f}')
            print()

            # Active features
            print('=== Active features (non-zero) ===')
            if active_keys:
                for k in active_keys:
                    print(f'  {k}: {last_feats[k]}')
            else:
                print('  (none active)')
            print()

            # Summary line
            n_active    = len(active_keys)
            denominator = max(total, 18)
            print(f'✓ {n_active}/{denominator} features active')

            if inactive_keys:
                print('  Possibly dead integrations (value = 0.0):')
                for k in inactive_keys:
                    print(f'    - {k}')
            print()

    # ------------------------------------------------------------------ #
    # Final verdict
    # ------------------------------------------------------------------ #
    if all_ok:
        print('All servers OK.')
        sys.exit(0)
    else:
        print('One or more servers unreachable. See warnings above.')
        sys.exit(1)


if __name__ == '__main__':
    main()
