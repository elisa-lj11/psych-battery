"""
Patches index.html: replaces each activity scene's art block
with the PNG-based version + thin SVG animation overlays.
"""
import re, os

def read_b64(name):
    with open(f"/tmp/scene_{name}.txt") as f:
        return f.read().strip()

def img(b64):
    return f'<image href="data:image/png;base64,{b64}" x="0" y="0" width="160" height="160" image-rendering="pixelated"></image>'

STEAM = """<g class="scene-anim scene-steam-a anim-layer anim-steam" transform="translate({x1} {y1})">
              <g fill="#c0c8d4">
                <rect x="1" y="0" width="2" height="6"></rect>
                <rect x="0" y="2" width="1" height="2"></rect>
                <rect x="3" y="4" width="1" height="2"></rect>
                <rect x="1" y="6" width="2" height="4"></rect>
              </g>
            </g>
            <g class="scene-anim scene-steam-b anim-layer anim-steam anim-steam-2" transform="translate({x2} {y2})">
              <g fill="#c0c8d4">
                <rect x="1" y="0" width="2" height="6"></rect>
                <rect x="0" y="2" width="1" height="2"></rect>
                <rect x="3" y="4" width="1" height="2"></rect>
                <rect x="1" y="6" width="2" height="4"></rect>
              </g>
            </g>"""

Z_GLYPH = """<g class="scene-anim scene-z-{tag} anim-layer anim-z{extra}" transform="translate({x} {y}) scale({s})">
              <rect x="0" y="0" width="8" height="2" fill="#c0c8d4"></rect>
              <rect x="6" y="2" width="2" height="2" fill="#c0c8d4"></rect>
              <rect x="2" y="4" width="2" height="2" fill="#c0c8d4"></rect>
              <rect x="0" y="6" width="8" height="2" fill="#c0c8d4"></rect>
            </g>"""

scenes = {}

# ── go_outside ─────────────────────────────────────────────────────────
scenes["go_outside"] = (
    img(read_b64("go_outside")) +
    """
            <rect x="124" y="8" width="18" height="18" fill="#f4d030" class="anim-layer anim-sun" opacity="0.35"></rect>
            <rect x="16" y="40" width="36" height="12" fill="#d8e4f0" class="anim-layer anim-cloud" opacity="0.5"></rect>"""
)

# ── connect_people ─────────────────────────────────────────────────────
scenes["connect_people"] = (
    img(read_b64("connect_people")) + """
            <rect x="22" y="34" width="36" height="10" fill="rgba(220,232,255,0.5)" class="anim-layer anim-bubble"></rect>
            <rect x="22" y="36" width="36" height="6" fill="rgba(200,215,250,0.4)" class="anim-layer anim-bubble"></rect>"""
)

# ── eat_food ───────────────────────────────────────────────────────────
# steam over the coffee mug (at ~x=128,y=72 in 160px space → /2 = 64,36 logical → *2=128,72)
# fork animation: the fork in the scene is at right of plate
scenes["eat_food"] = (
    img(read_b64("eat_food")) +
    "\n            " + STEAM.format(x1=128, y1=58, x2=136, y2=54) +
    """
            <g class="scene-anim scene-fork anim-layer anim-fork" transform="translate(116 92)">
              <g fill="#b0b8c0">
                <rect x="0" y="0" width="10" height="2"></rect>
                <rect x="0" y="2" width="2" height="6"></rect>
                <rect x="3" y="2" width="2" height="6"></rect>
                <rect x="6" y="2" width="2" height="6"></rect>
                <rect x="4" y="8" width="2" height="12"></rect>
              </g>
            </g>"""
)

# ── take_nap ───────────────────────────────────────────────────────────
scenes["take_nap"] = (
    img(read_b64("take_nap")) +
    "\n            " + Z_GLYPH.format(tag="a", extra="", x=74, y=54, s=1) +
    "\n            " + Z_GLYPH.format(tag="b", extra=" anim-z-2", x=86, y=50, s=0.8) +
    "\n            " + Z_GLYPH.format(tag="c", extra="", x=98, y=56, s=0.6)
)

# ── zoom_meeting ───────────────────────────────────────────────────────
# red REC dot at approx top-right of monitor (x=106,y=32 in 160px)
scenes["zoom_meeting"] = (
    img(read_b64("zoom_meeting")) +
    """
            <g class="scene-anim scene-recdot anim-layer anim-recdot" transform="translate(106 32)">
              <rect x="0" y="0" width="6" height="6" fill="#e03030"></rect>
            </g>"""
)

# ── heavy_async ────────────────────────────────────────────────────────
# notification badges pulse
scenes["heavy_async"] = (
    img(read_b64("heavy_async")) +
    """
            <rect x="8" y="16" width="10" height="10" rx="3" fill="#e83030" class="anim-layer anim-bubble" opacity="0.85"></rect>
            <rect x="124" y="12" width="10" height="10" rx="3" fill="#e8c030" class="anim-layer anim-bubble" opacity="0.85"></rect>
            <rect x="8" y="52" width="10" height="10" rx="3" fill="#3080e8" class="anim-layer anim-bubble anim-bubble-2" opacity="0.85"></rect>
            <rect x="128" y="44" width="10" height="10" rx="3" fill="#e83030" class="anim-layer anim-bubble anim-bubble-2" opacity="0.85"></rect>"""
)

# ── deep_work ──────────────────────────────────────────────────────────
# coffee steam + cursor blink
scenes["deep_work"] = (
    img(read_b64("deep_work")) +
    "\n            " + STEAM.format(x1=32, y1=62, x2=38, y2=58) +
    """
            <rect x="94" y="70" width="4" height="6" fill="#b8d8ff" class="anim-layer anim-cursor"></rect>"""
)

# ── late_night_ai ──────────────────────────────────────────────────────
# coffee steam + screen glow pulse + star twinkles
scenes["late_night_ai"] = (
    img(read_b64("late_night_ai")) +
    "\n            " + STEAM.format(x1=144, y1=62, x2=150, y2=58) +
    """
            <rect x="72" y="32" width="72" height="50" fill="rgba(80,160,255,0.06)" class="scene-anim scene-late-glow anim-layer anim-glow"></rect>
            <rect x="14" y="18" width="2" height="2" fill="#d8d8b0" class="scene-anim scene-star-a anim-layer anim-star"></rect>
            <rect x="24" y="28" width="2" height="2" fill="#d8d8b0" class="scene-anim scene-star-b anim-layer anim-star"></rect>
            <rect x="10" y="36" width="2" height="2" fill="#d8d8b0" class="scene-anim scene-star-c anim-layer anim-star"></rect>"""
)

# ── patch index.html ───────────────────────────────────────────────────
html_path = "index.html"
with open(html_path, encoding="utf-8") as f:
    html = f.read()

# For each scene, replace: everything from `art = \`` to closing `\`;`
# within the case block. We match art = `...`; non-greedily.
for scene_id, new_art in scenes.items():
    # Pattern: case "scene_id": followed by art = `...`; (the closing ` is on its own line with spaces then `;)
    # We'll find the art = ` start and the matching `; end within that case.
    # Strategy: find `case "scene_id":` then find next `art = \`` and replace up to `\`;\n`
    case_marker = f'case "{scene_id}":'
    pos = html.find(case_marker)
    if pos == -1:
        print(f"WARNING: case {scene_id} not found in index.html")
        continue
    art_start = html.find("art = `", pos)
    if art_start == -1:
        print(f"WARNING: art = ` not found for {scene_id}")
        continue
    # Find closing backtick-semicolon (the art string closer)
    # It appears as `;\n after some whitespace at start of line
    art_end = html.find("`;\n", art_start + 7)
    if art_end == -1:
        print(f"WARNING: art closer not found for {scene_id}")
        continue
    # Replacement: art = `\n            <new art>\n          `
    replacement = "art = `\n            " + new_art + "\n          `"
    html = html[:art_start] + replacement + html[art_end + 2:]  # +2 skips `; keep \n
    print(f"Patched: {scene_id}")

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)
print("Done. index.html updated.")
