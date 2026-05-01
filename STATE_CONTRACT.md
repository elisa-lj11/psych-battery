# STATE_CONTRACT

## GET /state

Exact contract:

```text
GET /state -> {
  "E_display": float 0-1,
  "status": "live" | "stale" | "offline",
  "last_update_iso": ISO timestamp,
  // any other existing fields preserved
}
```

Expanded response shape:

```json
{
  "E_display": 0.5274354959498876,
  "battery_pct": 53,
  "trend": "up",
  "status": "live",
  "last_update_iso": "2026-05-01T10:38:19.105639",
  "source": "model",
  "aw_connected": true,
  "last_tick_iso": "2026-05-01T10:38:19.105639",
  "data_age_sec": 4.812,
  "heartbeat_age_sec": 9.921,
  "last_display_heartbeat_iso": "2026-05-01T10:38:28.902000-07:00"
}
```

Rules:

- `E_display` is authoritative for both the browser and the CrowPanel.
- `battery_pct = round(E_display * 100)`.
- `trend` is server-derived: `up | down | flat`.
- `status` is server-derived: `live | stale | offline`.
- `last_update_iso` mirrors the freshest model/demo timestamp the server used for the current payload. Today that is the same value as `last_tick_iso`.
- `source` is one of `model | demo | aw-fallback`.
- When `source = model`, extra Flask fields such as `E_internal`, `S`, `E_rest_now`, `last_feats`, `phase`, and `chronotype` pass through unchanged.
- When `source = demo`, `/state` returns the last demo payload pushed by the UI agent until cleared or expired.
- `status` logic is:
  - `offline` if `heartbeat_age_sec` is missing or greater than `60`
  - `stale` if not offline and (`aw_connected` is `false` or `data_age_sec` is missing or greater than `300`)
  - `live` otherwise

## PUT /heartbeat

Request body:

```json
{}
```

The body is optional; any JSON object is accepted.

Response:

```json
{
  "ok": true,
  "last_display_heartbeat_iso": "2026-05-01T10:38:28.902000-07:00"
}
```

Rules:

- `charge_sender.py` calls this after each serial packet that receives an `ACK` from the CrowPanel.
- The server records only the receipt time and uses it to derive `/state.status`.

## PUT /demo-state

Request body:

```json
{
  "E_display": 0.72,
  "E_internal": 72,
  "S": 28,
  "E_rest_now": 68,
  "last_tick_iso": "2026-05-01T17:40:00.000Z",
  "last_feats": {},
  "phase": 0,
  "chronotype": "intermediate",
  "aw_connected": true
}
```

Rules:

- Required field: `E_display`.
- Recommended fields: mirror the frontend's existing synthetic model payload so `/state` stays shape-compatible with the live Flask payload.
- If `aw_connected` is omitted, the server defaults it to `true` for demo traffic.
- Each successful PUT activates `source = demo` for `/state`.
- Demo override TTL is `600` seconds from the last successful PUT.

## DELETE /demo-state

Response:

```json
{
  "ok": true,
  "demo_active": false
}
```

Rules:

- Clears the demo override immediately.
- After DELETE, `/state` falls back to `model` or `aw-fallback`.

## Required `index.html` Changes For The UI Agent

1. On entering interactive demo, call `PUT /demo-state` with the current synthetic payload.
2. On every demo-state change that updates the on-screen battery/stress/model values, call `PUT /demo-state` again so the CrowPanel stays in sync.
3. On exiting demo, switching back to live mode, or unloading the page, call `DELETE /demo-state`.
4. Surface `/state.status` literally in the connection/status UI using the three server strings: `live`, `stale`, `offline`.
5. If the UI wants to distinguish demo from live data, also read `/state.source`.
