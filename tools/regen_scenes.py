"""
Regenerates eat_food and connect_people pixel-art PNGs and patches index.html.
eat_food: adds a seated figure at the left of the table facing the food.
connect_people: full redesign — two people seated across from each other, facing in.
"""
import re, base64, io
from PIL import Image, ImageDraw

W, H = 160, 160

def px(img, x, y, color):
    if 0 <= x < W and 0 <= y < H:
        img.putpixel((x, y), color)

def rect(draw, x1, y1, x2, y2, color):
    draw.rectangle([x1, y1, x2, y2], fill=color)

def encode(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()

def patch_html(html, scene_id, b64):
    case_pos = html.find(f'case "{scene_id}":')
    chunk = html[case_pos:case_pos + 30000]
    m = re.search(r'(data:image/png;base64,)([A-Za-z0-9+/=]+)', chunk)
    old = m.group(2)
    pos = html.find("data:image/png;base64," + old, case_pos)
    html = html[:pos] + "data:image/png;base64," + b64 + html[pos + len("data:image/png;base64," + old):]
    return html

# ── PALETTE ───────────────────────────────────────────────────────────────────
WALL      = (220, 200, 168)
WALL2     = (200, 182, 150)
FLOOR     = (160, 128,  88)
FLOOR2    = (140, 110,  72)
TABLE_TOP = (180, 120,  60)
TABLE_LEG = (140,  90,  40)
TABLE_S   = (160, 105,  50)
SKIN      = (230, 180, 130)
SKIN_D    = (200, 150, 100)
HAIR_BRN  = ( 80,  50,  20)
HAIR_BLK  = ( 30,  20,  10)
SHIRT_B   = ( 60, 120, 200)
SHIRT_O   = (220, 120,  40)
PANTS_D   = ( 50,  60, 100)
PANTS_G   = ( 60,  80,  60)
SHOE      = ( 40,  30,  20)
WINDOW_F  = (180, 200, 220)
WINDOW_G  = (140, 170, 200)
FRAME     = (150, 120,  80)
PLATE     = (240, 235, 220)
PLATE_S   = (210, 205, 190)
MUG       = (160,  90,  40)
MUG_S     = (120,  65,  25)
FOOD_R    = (200,  60,  50)
FOOD_G    = ( 80, 170,  80)
FOOD_Y    = (220, 190,  50)
STEAM     = (200, 215, 230)
CHAIR     = (120,  80,  40)
CHAIR_S   = ( 90,  55,  20)
BOOK_R    = (180,  50,  50)
BOOK_B    = ( 50,  80, 180)
LAMP      = (240, 200,  80)
LAMP_B    = (100,  70,  30)
CURTAIN   = (160,  80,  80)
NIGHT     = ( 20,  20,  60)
STAR      = (240, 230, 180)
MOON      = (240, 230, 160)

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  eat_food  — person seated at left of table, facing the plate              ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
img = Image.new("RGBA", (W, H), WALL)
draw = ImageDraw.Draw(img)

# Wall
rect(draw, 0, 0, W-1, 90, WALL)
# Floor
rect(draw, 0, 91, W-1, H-1, FLOOR)
rect(draw, 0, 91, W-1, 94, FLOOR2)

# Window (upper right)
rect(draw, 110, 8, 150, 52, FRAME)
rect(draw, 113, 11, 148, 50, WINDOW_G)
# Panes
rect(draw, 113, 11, 148, 29, WINDOW_F)
rect(draw, 113, 31, 148, 50, WINDOW_G)
rect(draw, 129, 11, 131, 50, FRAME)
rect(draw, 113, 29, 148, 31, FRAME)
# Sill
rect(draw, 108, 52, 153, 56, FRAME)

# Table (spans most of width, sits on floor)
TABLE_Y1, TABLE_Y2 = 88, 100
rect(draw, 30, TABLE_Y1, W-8, TABLE_Y2, TABLE_TOP)
rect(draw, 30, TABLE_Y1, W-8, TABLE_Y1+2, TABLE_S)
# Table legs
rect(draw, 32, TABLE_Y2, 40, H-20, TABLE_LEG)
rect(draw, W-20, TABLE_Y2, W-12, H-20, TABLE_LEG)

# Chair (left side, person sits on it)
# Chair back
rect(draw, 14, 62, 26, 86, CHAIR)
rect(draw, 14, 62, 26, 65, CHAIR_S)
# Chair seat
rect(draw, 12, 86, 30, 91, CHAIR)
# Chair legs
rect(draw, 13, 91, 17, H-20, CHAIR_S)
rect(draw, 24, 91, 28, H-20, CHAIR_S)

# Person seated at left — facing right (toward food)
# Body/torso (blue shirt), partially behind table edge
rect(draw, 16, 70, 30, 88, SHIRT_B)       # torso
rect(draw, 30, 80, 38, 88, SHIRT_B)       # right arm on table
rect(draw, 32, 78, 38, 82, SKIN)          # hand on table
# Head
rect(draw, 18, 58, 32, 70, SKIN)
rect(draw, 20, 56, 30, 60, HAIR_BRN)     # hair top
rect(draw, 18, 58, 20, 68, HAIR_BRN)     # hair side
# Eye
px(img, 28, 63, (40, 30, 20))
px(img, 29, 63, (40, 30, 20))
# Legs (below table, on chair)
rect(draw, 16, 88, 24, 94, PANTS_D)

# Plate (center of table)
rect(draw, 70, 82, 108, 92, PLATE)
rect(draw, 72, 83, 106, 91, PLATE_S)
# Food on plate
rect(draw, 75, 84, 85, 89, FOOD_R)       # red item
rect(draw, 88, 84, 96, 89, FOOD_G)       # green item
rect(draw, 80, 84, 87, 87, FOOD_Y)       # yellow item
# Fork left of plate
rect(draw, 62, 85, 64, 92, (160,160,170))
rect(draw, 61, 85, 65, 87, (160,160,170))

# Mug (right of plate)
rect(draw, 115, 78, 132, 92, MUG)
rect(draw, 115, 78, 132, 81, MUG_S)
rect(draw, 132, 82, 138, 88, MUG)        # handle
rect(draw, 133, 83, 137, 87, TABLE_TOP)  # handle hole
# Steam above mug
for sy in [70, 66, 62]:
    rect(draw, 119, sy, 121, sy+2, STEAM)
    rect(draw, 124, sy-2, 126, sy, STEAM)

# Baseboard
rect(draw, 0, 88, W-1, 92, WALL2)

img = img.convert("RGBA")
eat_food_b64 = encode(img)
print("eat_food generated:", img.size)

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  connect_people — two people seated across from each other, facing in       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
img2 = Image.new("RGBA", (W, H), (210, 190, 160))
draw2 = ImageDraw.Draw(img2)

WALL_C  = (215, 195, 162)
WALL_C2 = (195, 175, 142)
FLOOR_C = (155, 125,  85)
FLOOR_C2= (135, 108,  70)
TABLE_C = (170, 115,  55)
TABLE_CS= (150, 100,  45)
COUCH_L = ( 90, 130, 180)   # left person shirt
COUCH_R = (180,  80,  80)   # right person shirt

# Wall background
rect(draw2, 0, 0, W-1, 94, WALL_C)
# Baseboard
rect(draw2, 0, 88, W-1, 94, WALL_C2)
# Floor
rect(draw2, 0, 94, W-1, H-1, FLOOR_C)
rect(draw2, 0, 94, W-1, 97, FLOOR_C2)

# Picture/art on wall — center decoration
rect(draw2, 58, 10, 102, 44, FRAME)
rect(draw2, 61, 13, 99, 41, (180, 200, 220))
# Abstract art inside frame
rect(draw2, 64, 16, 80, 28, (160, 80, 80))
rect(draw2, 82, 20, 96, 38, (80, 130, 170))
rect(draw2, 64, 30, 78, 40, (80, 160, 100))

# Coffee table (low, between the two people)
T_Y1, T_Y2 = 90, 98
rect(draw2, 50, T_Y1, 110, T_Y2, TABLE_C)
rect(draw2, 50, T_Y1, 110, T_Y1+2, TABLE_CS)
# Cups on table
rect(draw2, 62, 84, 70, 92, MUG)          # left cup
rect(draw2, 62, 84, 70, 87, MUG_S)
rect(draw2, 90, 84, 98, 92, MUG)          # right cup
rect(draw2, 90, 84, 98, 87, MUG_S)

# ── LEFT PERSON (facing right) ────────────────────────────────────────────────
# Seated on left chair, leaning slightly forward
# Chair back (left)
rect(draw2, 4, 54, 16, 88, CHAIR)
rect(draw2, 4, 54, 16, 57, CHAIR_S)
rect(draw2, 4, 88, 38, 94, CHAIR)       # seat
rect(draw2, 4, 90, 38, 94, CHAIR_S)

# Body (blue shirt), facing right → arm extended right
rect(draw2, 14, 66, 34, 90, COUCH_L)   # torso
rect(draw2, 34, 74, 48, 82, COUCH_L)   # right arm extending toward table
rect(draw2, 44, 72, 50, 78, SKIN)      # right hand

# Head facing right
rect(draw2, 16, 52, 32, 66, SKIN)
rect(draw2, 16, 50, 30, 54, HAIR_BRN)
rect(draw2, 16, 52, 18, 64, HAIR_BRN)
# Eyes (looking right)
px(img2, 28, 57, (40, 30, 20))
px(img2, 29, 57, (40, 30, 20))
# Smile
for sx in range(24, 30):
    px(img2, sx, 63, (160, 100, 80))

# Legs on chair
rect(draw2, 14, 90, 22, 96, PANTS_D)
rect(draw2, 24, 90, 32, 96, PANTS_D)

# ── RIGHT PERSON (facing left) ────────────────────────────────────────────────
# Chair back (right)
rect(draw2, W-17, 54, W-5, 88, CHAIR)
rect(draw2, W-17, 54, W-5, 57, CHAIR_S)
rect(draw2, W-39, 88, W-5, 94, CHAIR)
rect(draw2, W-39, 90, W-5, 94, CHAIR_S)

# Body (red shirt), facing left
rect(draw2, W-35, 66, W-15, 90, COUCH_R)   # torso
rect(draw2, W-49, 74, W-35, 82, COUCH_R)   # left arm
rect(draw2, W-51, 72, W-45, 78, SKIN)       # left hand

# Head facing left
rect(draw2, W-33, 52, W-17, 66, SKIN)
rect(draw2, W-31, 50, W-17, 54, HAIR_BLK)
rect(draw2, W-19, 52, W-17, 64, HAIR_BLK)
# Eyes (looking left)
px(img2, W-30, 57, (40, 30, 20))
px(img2, W-29, 57, (40, 30, 20))
# Smile
for sx in range(W-30, W-24):
    px(img2, sx, 63, (160, 100, 80))

# Legs
rect(draw2, W-33, 90, W-25, 96, PANTS_G)
rect(draw2, W-23, 90, W-15, 96, PANTS_G)

# Speech lines (between the two, mid-air) — simple pixel "chat" lines
for lx in range(54, 106, 6):
    rect(draw2, lx, 46, lx+4, 47, (180, 180, 200))
for lx in range(58, 102, 6):
    rect(draw2, lx, 50, lx+3, 51, (180, 180, 200))

img2 = img2.convert("RGBA")
connect_b64 = encode(img2)
print("connect_people generated:", img2.size)

# ── PATCH index.html ──────────────────────────────────────────────────────────
html = open("index.html", encoding="utf-8").read()
html = patch_html(html, "eat_food", eat_food_b64)
print("Patched eat_food")
html = patch_html(html, "connect_people", connect_b64)
print("Patched connect_people")
open("index.html", "w", encoding="utf-8").write(html)
print("Done.")
