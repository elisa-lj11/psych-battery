"""
Extracts each scene PNG from index.html, samples background colors at
problem coordinates, paints over the bugs, and re-embeds.

Problem areas (in 160×160 pixel space):
  go_outside   — ghost character bottom-left ~(4-14, 120-138)
  eat_food     — floating figure top-left ~(6-34, 36-78)
  deep_work    — stray yellow rect ~(46-72, 36-50)
  zoom_meeting — tiny figure left-side ~(4-22, 58-90)
  heavy_async  — badge rects clipped at left/bottom edges
  connect_people — speech bubble overlay repositioned in JS (not PNG)
"""
import re, base64, io, sys
from PIL import Image

HTML = "index.html"
html = open(HTML, encoding="utf-8").read()

def get_png(scene_id):
    """Extract base64 PNG for a scene from the JS switch statement."""
    case_pos = html.find(f'case "{scene_id}":')
    assert case_pos != -1, f"case {scene_id} not found"
    chunk = html[case_pos:case_pos + 30000]
    m = re.search(r'data:image/png;base64,([A-Za-z0-9+/=]+)', chunk)
    assert m, f"no PNG found for {scene_id}"
    return base64.b64decode(m.group(1))

def set_png(scene_id, img_bytes):
    """Replace the base64 PNG for a scene in index.html."""
    global html
    case_pos = html.find(f'case "{scene_id}":')
    chunk_start = case_pos
    chunk = html[chunk_start:chunk_start + 30000]
    m = re.search(r'(data:image/png;base64,)([A-Za-z0-9+/=]+)', chunk)
    old_b64 = m.group(2)
    new_b64 = base64.b64encode(img_bytes).decode()
    # Replace only the first occurrence after case_pos
    old_full = "data:image/png;base64," + old_b64
    new_full = "data:image/png;base64," + new_b64
    pos = html.find(old_full, case_pos)
    html = html[:pos] + new_full + html[pos + len(old_full):]

def open_scene(scene_id):
    return Image.open(io.BytesIO(get_png(scene_id))).convert("RGBA")

def save_scene(img, scene_id):
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    set_png(scene_id, buf.getvalue())

def sample_color(img, x, y, radius=2):
    """Sample average color in a small area around (x,y)."""
    pixels = []
    for dy in range(-radius, radius+1):
        for dx in range(-radius, radius+1):
            px, py = x+dx, y+dy
            if 0 <= px < img.width and 0 <= py < img.height:
                pixels.append(img.getpixel((px, py)))
    r = sum(p[0] for p in pixels) // len(pixels)
    g = sum(p[1] for p in pixels) // len(pixels)
    b = sum(p[2] for p in pixels) // len(pixels)
    return (r, g, b, 255)

def fill_rect(img, x1, y1, x2, y2, color):
    """Paint a filled rectangle on the image."""
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    draw.rectangle([x1, y1, x2, y2], fill=color)
    return img

# ── go_outside: ghost character at bottom-left ────────────────────────────────
print("Fixing go_outside...")
img = open_scene("go_outside")
# Sample ground color just to the right of the ghost (solid ground area)
ground_color = sample_color(img, 20, 130, radius=3)
print(f"  ground color sample: {ground_color}")
# Cover the ghost character area — sample a few reference points to get blends
# The ghost is at roughly x=4-14, y=119-138
# Paint each pixel row with the sampled color from the same row to the right
from PIL import ImageDraw
draw = ImageDraw.Draw(img)
for row in range(118, 140):
    # Sample color from x=18 (clear ground, right of ghost)
    ref_color = img.getpixel((min(20, img.width-1), row))
    draw.line([(3, row), (16, row)], fill=ref_color)
save_scene(img, "go_outside")
print("  done")

# ── eat_food: floating figure top-left ────────────────────────────────────────
print("Fixing eat_food...")
img = open_scene("eat_food")
# The figure floats at approx x=6-34, y=36-80
# Sample the wall color from the same y-range but further right (clear wall)
draw = ImageDraw.Draw(img)
for row in range(34, 82):
    for col in range(4, 36):
        # Sample wall color from same row at x=55 (clear wall area)
        ref_color = img.getpixel((min(55, img.width-1), row))
        img.putpixel((col, row), ref_color)
save_scene(img, "eat_food")
print("  done")

# ── deep_work: stray yellow rect above character ──────────────────────────────
print("Fixing deep_work...")
img = open_scene("deep_work")
# Yellow rect at approx x=46-72, y=36-50
# Sample wall color from same row slightly to the right
draw = ImageDraw.Draw(img)
for row in range(34, 52):
    for col in range(44, 74):
        ref_color = img.getpixel((min(130, img.width-1), row))
        img.putpixel((col, row), ref_color)
save_scene(img, "deep_work")
print("  done")

# ── zoom_meeting: tiny figure left side ───────────────────────────────────────
print("Fixing zoom_meeting...")
img = open_scene("zoom_meeting")
# Tiny figure at approx x=4-22, y=57-92
draw = ImageDraw.Draw(img)
for row in range(55, 95):
    for col in range(2, 24):
        # Sample wall color from same row at x=50 (clear wall to right of figure)
        ref_color = img.getpixel((min(50, img.width-1), row))
        img.putpixel((col, row), ref_color)
save_scene(img, "zoom_meeting")
print("  done")

# Write fixed HTML
open(HTML, "w", encoding="utf-8").write(html)
print("\nDone. index.html updated with 4 fixed scenes.")
print("Note: connect_people speech bubble and heavy_async badge positions")
print("are SVG overlay fixes (not PNG) — handled separately in the HTML switch.")
