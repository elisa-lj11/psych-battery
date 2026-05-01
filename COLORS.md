# Color System

How color works in Mental Meter. Read this before touching any `--px-*`
token in `index.html`.

## The one rule

UI elements pick a **role**, not a hex code. Themes only swap what the
roles look like. So a stress tank stays "stress-coded" whether you're in
`arcade`, `pastel`, `acrylic`, or `light`.

```css
/* yes */
.layer2-tank-stress {
  background: var(--px-stress-soft);
  border-color: var(--px-stress);
}

/* no */
.layer2-tank-stress {
  background: rgba(255, 107, 109, 0.14);
}
```

## The four themes

| Theme   | Vibe                                  | Background | Primary accent |
| ------- | ------------------------------------- | ---------- | -------------- |
| arcade  | Default. Dark navy + neon purple.     | `#0a1018`  | `#b08cff`      |
| pastel  | Soft warm dusk. Lilac + mint + coral. | `#2a1f3d`  | `#d6b3ff`      |
| acrylic | Translucent glass. Slate + cyan-blue. | `#0e1422`  | `#8fbeff`      |
| light   | Daylight mode. Cool greys + violet.   | `#eef3fb`  | `#7f61d9`      |

`light` is one-of-a-kind (the toggle in the settings menu flips between
"the last dark theme you used" and `light`). The other three are dark.

## Token map

Eight semantic tiers. Every theme overrides the same set; rules read
the variable, not a literal.

### Surface (the canvas)

| Token                     | Used for                                   |
| ------------------------- | ------------------------------------------ |
| `--px-bg`                 | App background                             |
| `--px-bg-top` / `-bottom` | Optional gradient anchors (we use solids)  |
| `--px-surface`            | First card layer (cards on the page)       |
| `--px-surface-2`          | Second layer (cards inside cards)          |
| `--px-surface-3`          | Third layer (deepest nesting)              |
| `--px-panel`              | Floating panels (popovers, dock, dropdown) |
| `--px-panel-soft`         | Same as panel but lower contrast           |

### Border

| Token           | Used for                          |
| --------------- | --------------------------------- |
| `--px-border`   | Subtle dividers                   |
| `--px-border-2` | Stronger borders (active buttons) |

### Text

| Token        | Used for                  |
| ------------ | ------------------------- |
| `--px-text`  | Primary copy + numbers    |
| `--px-muted` | Secondary copy + captions |

### Action / brand

| Token              | Used for                                              |
| ------------------ | ----------------------------------------------------- |
| `--px-accent`      | Brand color. Active state, primary buttons, callouts. |
| `--px-accent-soft` | rgba @ ~14% — tinted backgrounds for accent buttons.  |
| `--px-info`        | Cool partner to accent. Secondary info signals only.  |
| `--px-focus`       | `:focus-visible` outline. Always high-contrast vs bg. |

### Domain colors (the model)

These map 1:1 with the model's three core signals. **Use these, not the
status colors, when the surface represents one of them.**

| Token           | Means                    | Soft companion       |
| --------------- | ------------------------ | -------------------- |
| `--px-energy`   | Energy tank, polyline    | `--px-energy-soft`   |
| `--px-stress`   | Stress tank, polyline    | `--px-stress-soft`   |
| `--px-recovery` | Recovery actions/signals | `--px-recovery-soft` |

### Status colors (generic)

For things that aren't energy/stress/recovery but still need a state.

| Token           | Means                  |
| --------------- | ---------------------- |
| `--px-good`     | OK, succeeded, healthy |
| `--px-warn`     | Warning, attention     |
| `--px-low`      | Low / depleted         |
| `--px-critical` | Error, danger, alert   |

### Soft variants

Anything ending in `-soft` is the parent color at ~14–18% alpha. They're
the **only** tinted-fill the system uses — no gradients, no opacity
stacks. If you want a tinted button background:

```css
background: var(--px-accent-soft);
border-color: var(--px-accent);
color: var(--px-accent);
```

That's the pattern for every "colored" button (Energy, Stress, Recovery,
Tune, theme swatches).

## Stacking rules

1. **One semantic role per element.** Energy is never `accent`; stress
   is never `critical`; recovery is never `info`. The tokens decouple
   "what is this thing" from "what theme are we in."

2. **No gradients.** Backgrounds are flat tokens. Soft variants exist
   for tinted fills.

3. **Borders match the role.** A button in the energy domain gets
   `border: var(--px-energy)`, not `var(--px-border)`. Generic chrome
   uses `--px-border` / `--px-border-2`.

4. **Text on tinted fill uses the parent role color.** Text inside a
   `--px-energy-soft` button is `--px-energy`, not `--px-text`.

5. **`--px-focus` always wins.** Never override the focus ring color
   per-element — it's a system promise that focus is always visible.

## Adding a new theme

1. Copy any `body[data-theme="X"] { … }` block in `index.html`.
2. Override every `--px-*` listed in this doc. Don't skip any —
   missing tokens fall back to the default `:root` (arcade) and look
   wrong.
3. Add the theme name to the `DARK_THEMES` array (or replace `light`
   handling) and `THEME_LABELS` map in the JS at the bottom.
4. Add a `.theme-swatch` button in the settings dropdown HTML.

Rule of thumb: pick three "colorful" hexes and let everything else
follow from them.

- `--px-accent` is your brand color
- `--px-energy` should read as "alive / good" in the theme's mood
- `--px-stress` should read as "alarmed / hot" in the theme's mood
- Then `--px-recovery` is usually a cool blue-ish neighbor of `--px-info`

## Files that reference these tokens

- `index.html` — the entire `<style>` block + theme swatch HTML +
  the `THEME_LABELS` / `DARK_THEMES` constants in JS
- That's it. There are no other CSS files.

## Quick lookup: when you want a color, ask…

> "Is this thing an energy/stress/recovery surface?" → use the domain token
> "Is it a generic status (ok/warn/error)?" → use a status token
> "Is it brand / interactive accent?" → use `--px-accent`
> "Is it just chrome (border, panel, text)?" → use a surface/border/text token
