"""
Generate improved pixel-art PNGs for the 4 new psych-battery activity scenes:
  stretch, hydrate, back_to_back, after_hours

80x80 logical grid, SCALE=2 → 160x160 PNG.
Patches each case block in index.html, replacing the SVG-rect art with
<image href="data:image/png;base64,..."> + animated SVG overlays.
"""
import re, base64, io, os, sys
from PIL import Image

W, H, SCALE = 80, 80, 2

# ── Palette ───────────────────────────────────────────────────────────────────
SKY        = ( 74, 120, 192, 255)
WALL       = (200, 190, 175, 255)
WALL_D     = (175, 162, 145, 255)
WALL_TRIM  = (155, 140, 120, 255)
FLOOR      = (180, 155, 120, 255)
FLOOR_D    = (155, 130,  95, 255)
FLOOR_L    = (200, 175, 140, 255)
MAT_G      = ( 58, 158,  72, 255)
MAT_GD     = ( 40, 120,  52, 255)
SKIN       = (220, 168, 112, 255)
SKIN_D     = (185, 130,  80, 255)
HAIR_BR    = ( 70,  45,  20, 255)
HAIR_BL    = ( 30,  20,  15, 255)
SHIRT_T    = ( 64, 160, 200, 255)
SHIRT_TD   = ( 44, 128, 168, 255)
SHIRT_O    = (210, 100,  50, 255)
SHIRT_G    = ( 60, 170,  80, 255)
PANTS_B    = ( 60,  80, 160, 255)
PANTS_BD   = ( 44,  60, 130, 255)
PANTS_G    = ( 70,  90,  70, 255)
SHOE       = ( 50,  40,  30, 255)
SHOE_L     = ( 70,  58,  42, 255)
NIGHT_SKY  = ( 12,  14,  36, 255)
ROOM_D     = ( 22,  20,  34, 255)
ROOM_WALL  = ( 38,  34,  56, 255)
ROOM_WALL2 = ( 50,  46,  70, 255)
MOON       = (240, 235, 190, 255)
STAR_C     = (210, 210, 180, 255)
MONITOR    = ( 32,  30,  42, 255)
MONITOR_L  = ( 52,  48,  64, 255)
SCREEN_OFF = (  8,  12,  24, 255)
SCREEN_BLU = ( 18,  46, 120, 255)
CODE_G     = ( 72, 200,  72, 255)
CODE_B     = ( 72, 156, 230, 255)
CODE_Y     = (230, 195,  55, 255)
CODE_P     = (195,  95, 215, 255)
CODE_DIM   = ( 42,  80, 100, 255)
DESK       = (160, 115,  65, 255)
DESK_D     = (120,  82,  42, 255)
DESK_L     = (190, 145,  90, 255)
DESK_EDGE  = (100,  66,  30, 255)
WATER      = ( 38, 116, 210, 255)
WATER_L    = ( 80, 158, 240, 255)
WATER_D    = ( 24,  80, 160, 255)
GLASS_G    = (195, 218, 235, 255)
GLASS_S    = (228, 242, 252, 255)
GLASS_D    = (155, 180, 205, 255)
COUNTER    = (170, 138,  90, 255)
COUNTER_D  = (140, 110,  68, 255)
COUNTER_L  = (195, 162, 112, 255)
CABINET    = (140, 105,  62, 255)
CABINET_D  = (110,  80,  44, 255)
CAL_BG     = (238, 235, 230, 255)
CAL_LINE   = (195, 190, 182, 255)
CAL_HEAD   = ( 46,  46,  64, 255)
CAL_TEXT   = (120, 118, 115, 255)
MEET_R1    = (198,  54,  42, 255)
MEET_R2    = (168,  38,  28, 255)
MEET_R3    = (218,  78,  58, 255)
MEET_O     = (210, 108,  36, 255)
MEET_OD    = (175,  82,  22, 255)
NOTIF      = (240,  80,  60, 255)
NOTIF_Y    = (240, 200,  50, 255)
WINDOW_F   = (168, 196, 228, 255)
WINDOW_G   = (128, 168, 208, 255)
WINDOW_FR  = (130, 115,  90, 255)
PLANT_G    = ( 60, 158,  60, 255)
PLANT_D    = ( 38, 118,  38, 255)
POT        = (170,  80,  50, 255)
POT_D      = (135,  58,  32, 255)
WHITE      = (255, 255, 255, 255)
BLACK      = (  0,   0,   0, 255)
TRNSP      = (  0,   0,   0,   0)

def new_grid(bg):
    return [[bg] * W for _ in range(H)]

def px(g, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        g[y][x] = c

def rect(g, x, y, w, h, c):
    for dy in range(h):
        for dx in range(w):
            px(g, x+dx, y+dy, c)

def hline(g, y, x0, x1, c):
    for x in range(x0, x1+1): px(g, x, y, c)

def vline(g, x, y0, y1, c):
    for y in range(y0, y1+1): px(g, x, y, c)

def grid_to_b64(grid):
    img = Image.new("RGBA", (W*SCALE, H*SCALE))
    pix = img.load()
    for y in range(H):
        for x in range(W):
            c = grid[y][x]
            for sy in range(SCALE):
                for sx in range(SCALE):
                    pix[x*SCALE+sx, y*SCALE+sy] = c
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()

def save_preview(grid, name):
    img = Image.new("RGBA", (W*SCALE, H*SCALE))
    pix = img.load()
    for y in range(H):
        for x in range(W):
            c = grid[y][x]
            for sy in range(SCALE):
                for sx in range(SCALE):
                    pix[x*SCALE+sx, y*SCALE+sy] = c
    img.save(f"tools/{name}_preview.png")
    print(f"  saved tools/{name}_preview.png")

# ── Character helpers ─────────────────────────────────────────────────────────

def head(g, cx, y, skin=SKIN, hair=HAIR_BR):
    """3-wide head centered at cx, top at y."""
    rect(g, cx-1, y, 3, 3, skin)
    hline(g, y, cx-1, cx+1, hair)
    px(g, cx-1, y+1, hair)   # left hair shadow
    px(g, cx+1, y+1, (40,30,20,255))  # eye

def torso(g, cx, y, shirt, h=5):
    rect(g, cx-2, y, 5, h, shirt)
    # collar highlight
    px(g, cx-1, y, SKIN); px(g, cx, y, SKIN)

def legs(g, cx, y, pants, h=6):
    rect(g, cx-2, y, 2, h, pants)
    rect(g, cx+1, y, 2, h, pants)
    # shadow between legs
    vline(g, cx, y, y+h-1, PANTS_BD if pants==PANTS_B else pants)

def shoes(g, cx, y, color=SHOE):
    rect(g, cx-3, y, 3, 2, color)
    rect(g, cx+1, y, 3, 2, color)
    # toe highlight
    px(g, cx-3, y, SHOE_L); px(g, cx+1, y, SHOE_L)

def arm_left(g, cx, y0, y1, shirt):
    vline(g, cx-3, y0, y1, shirt)
    vline(g, cx-4, y0+1, y1-1, SHIRT_TD if shirt==SHIRT_T else shirt)

def arm_right(g, cx, y0, y1, shirt):
    vline(g, cx+3, y0, y1, shirt)
    vline(g, cx+4, y0+1, y1-1, SHIRT_TD if shirt==SHIRT_T else shirt)

# ── Scene: stretch ────────────────────────────────────────────────────────────
def scene_stretch():
    """Person doing a full overhead stretch with arms raised in a Y, on a yoga mat."""
    g = new_grid(WALL)

    # Wall texture — subtle horizontal banding
    for y in range(0, 54, 6):
        hline(g, y, 0, W-1, WALL_D)

    # Wall baseboard
    rect(g, 0, 52, W, 2, WALL_TRIM)

    # Floor
    rect(g, 0, 54, W, 26, FLOOR)
    # Floor planks
    for y in range(55, 80, 5):
        hline(g, y, 0, W-1, FLOOR_D)
    for x in range(0, W, 14):
        vline(g, x, 54, 79, FLOOR_D)

    # Yoga mat (centered)
    rect(g, 16, 54, 48, 7, MAT_G)
    hline(g, 54, 16, 63, MAT_GD)   # top edge
    hline(g, 60, 16, 63, MAT_GD)   # bottom edge
    vline(g, 16, 54, 60, MAT_GD)   # left edge
    vline(g, 63, 54, 60, MAT_GD)   # right edge

    # Plant pot (left side, decorative)
    rect(g, 4, 46, 7, 8, POT)
    rect(g, 5, 44, 5, 3, PLANT_G)
    rect(g, 6, 41, 4, 4, PLANT_G)
    px(g, 5, 41, PLANT_D); px(g, 9, 43, PLANT_D)
    hline(g, 46, 4, 10, POT_D)

    # ── Person: center at x=40 ──
    cx = 40
    # Feet on mat at y=56-57
    shoes(g, cx, 56)
    # Legs straight, y=46-55
    legs(g, cx, 46, PANTS_B, h=10)
    # Torso y=38-45
    torso(g, cx, 38, SHIRT_T, h=8)
    # Head y=34-36
    head(g, cx, 34)
    # Arms raised in Y-shape
    # Left arm: goes up-left from torso shoulder
    for i in range(8):
        px(g, cx-3-i, 38-i, SHIRT_T)
        px(g, cx-3-i, 39-i, SHIRT_TD)
    # Right arm: goes up-right
    for i in range(8):
        px(g, cx+3+i, 38-i, SHIRT_T)
        px(g, cx+3+i, 39-i, SHIRT_TD)
    # Hands (at tips of arms)
    rect(g, cx-11, 29, 3, 3, SKIN)
    rect(g, cx+9,  29, 3, 3, SKIN)
    # Finger details
    px(g, cx-11, 29, SKIN_D); px(g, cx+11, 29, SKIN_D)

    # Subtle shadow on floor under person
    for dx in range(-4, 5):
        px(g, cx+dx, 58, FLOOR_D)

    return grid_to_b64(g), g


# ── Scene: hydrate ────────────────────────────────────────────────────────────
def scene_hydrate():
    """Person at kitchen counter filling / drinking from a tall glass of water."""
    g = new_grid(WALL)

    # Wall texture
    for y in range(0, 44, 6):
        hline(g, y, 0, W-1, WALL_D)

    # Cabinet above counter (left side)
    rect(g, 0, 2, 34, 28, CABINET)
    rect(g, 1, 3, 32, 26, CABINET_D)
    # Cabinet door line
    vline(g, 17, 3, 28, CABINET)
    hline(g, 15, 1, 33, CABINET)
    # Cabinet handles
    rect(g, 10, 17, 5, 2, DESK_EDGE)
    rect(g, 20, 17, 5, 2, DESK_EDGE)

    # Window (right side, upper)
    rect(g, 48, 4, 28, 22, WINDOW_FR)
    rect(g, 49, 5, 26, 20, WINDOW_G)
    rect(g, 49, 5, 13, 9, WINDOW_F)    # upper pane
    rect(g, 50, 6, 11, 7, (190,218,242,255))
    rect(g, 62, 5, 13, 9, WINDOW_G)    # upper-right
    rect(g, 49,15, 26, 9, WINDOW_G)    # lower pane
    # Reflection shine
    vline(g, 51, 6, 8, (210,235,255,255))
    vline(g, 51,16,22, (210,235,255,255))

    # Counter surface
    rect(g, 0, 42, W, 6, COUNTER)
    hline(g, 42, 0, W-1, COUNTER_L)   # top highlight
    hline(g, 43, 0, W-1, COUNTER_L)
    hline(g, 47, 0, W-1, COUNTER_D)   # bottom edge
    # Counter lip/overhang
    rect(g, 0, 48, W, 3, DESK)
    hline(g, 48, 0, W-1, DESK_L)

    # Floor
    rect(g, 0, 51, W, 29, FLOOR)
    for y in range(53, 80, 5): hline(g, y, 0, W-1, FLOOR_D)

    # ── Tall glass on counter ──
    # Centered at x=54, on counter at y=30-42
    gx = 54
    # Glass body outline
    rect(g, gx-4, 30, 9, 13, GLASS_G)
    # Glass interior (water fill bottom 60%)
    rect(g, gx-3, 35, 7, 7, WATER)
    rect(g, gx-3, 34, 7, 2, WATER_L)  # water surface shimmer
    # Air/empty top
    rect(g, gx-3, 31, 7, 4, (218, 235, 248, 255))
    # Shine on glass left edge
    vline(g, gx-3, 31, 41, GLASS_S)
    # Glass rim
    hline(g, 30, gx-4, gx+4, GLASS_S)
    hline(g, 42, gx-4, gx+4, GLASS_D)
    # Condensation drops on glass exterior
    px(g, gx-4, 36, GLASS_S); px(g, gx-4, 39, GLASS_S)
    px(g, gx+4, 34, GLASS_S); px(g, gx+4, 38, GLASS_S)

    # Faucet above
    rect(g, gx-1, 22, 3, 8, MONITOR_L)
    rect(g, gx+2, 24, 5, 3, MONITOR_L)
    px(g, gx+6, 26, WATER_L)  # drip

    # ── Person ── at left side, reaching toward glass
    cx = 22
    # Feet
    shoes(g, cx, 58)
    # Legs
    legs(g, cx, 49, PANTS_B, h=9)
    # Torso (leaning slightly right — shift right side 1px)
    rect(g, cx-2, 40, 5, 9, SHIRT_T)
    px(g, cx+3, 41, SHIRT_T); px(g, cx+3, 42, SHIRT_T)  # lean
    # Collar
    px(g, cx-1, 40, SKIN); px(g, cx, 40, SKIN)
    # Head
    head(g, cx+1, 36, SKIN, HAIR_BL)
    # Left arm (hanging)
    arm_left(g, cx, 40, 47, SHIRT_T)
    # Right arm extended toward glass
    for i in range(7):
        px(g, cx+3+i, 42+min(i//3, 2), SHIRT_T)
        px(g, cx+3+i, 43+min(i//3, 2), SHIRT_TD)
    # Hand near glass
    rect(g, cx+9, 43, 3, 3, SKIN)

    return grid_to_b64(g), g


# ── Scene: back_to_back ───────────────────────────────────────────────────────
def scene_back_to_back():
    """Digital calendar showing a completely packed day — meeting blocks edge to edge."""
    g = new_grid(CAL_BG)

    # Outer card border
    rect(g, 4, 4, 72, 72, (228, 224, 218, 255))
    rect(g, 5, 5, 70, 70, CAL_BG)

    # ── Calendar header bar ──
    rect(g, 5, 5, 70, 11, CAL_HEAD)
    # Month label (implied by pixel blocks)
    for i, x in enumerate(range(10, 60, 8)):
        rect(g, x, 8, 5, 2, (80, 80, 100, 255))   # day labels row

    # Day-of-week column headers
    hline(g, 16, 5, 74, CAL_LINE)
    for x in range(5, 75, 10):
        rect(g, x+1, 17, 7, 3, CAL_TEXT)

    # Time gutter (left side, thin)
    rect(g, 5, 20, 8, 54, (215, 212, 206, 255))
    vline(g, 12, 20, 74, CAL_LINE)
    # Time labels
    for y, label_h in [(23,2),(31,2),(39,2),(47,2),(55,2),(63,2),(71,2)]:
        rect(g, 6, y, 5, label_h, CAL_TEXT)

    # ── Meeting blocks — completely packed column ──
    # 8 AM meeting (large, red — anchor)
    rect(g, 13, 20, 61, 9, MEET_R1)
    rect(g, 13, 20, 61, 2, MEET_R3)   # header highlight
    rect(g, 14, 22, 32, 2, (228,100,80,255))  # title text implied
    rect(g, 14, 24, 22, 2, (208, 80,60,255))  # subtitle

    # 9 AM meeting (overlapping, orange — different organizer)
    rect(g, 13, 29, 61, 9, MEET_O)
    rect(g, 13, 29, 61, 2, (230,130,60,255))
    rect(g, 14, 31, 28, 2, (190,100,30,255))
    rect(g, 14, 33, 18, 2, (175, 88,22,255))

    # 10 AM — another red block
    rect(g, 13, 38, 61, 9, MEET_R2)
    rect(g, 13, 38, 61, 2, MEET_R1)
    rect(g, 14, 40, 35, 2, (180, 58,48,255))

    # 11 AM — slightly different red
    rect(g, 13, 47, 61, 8, MEET_R1)
    rect(g, 13, 47, 61, 2, MEET_R3)
    rect(g, 14, 49, 25, 2, (218, 90,70,255))

    # 12 PM lunch — squeezed orange block
    rect(g, 13, 55, 61, 5, MEET_O)
    rect(g, 14, 56, 20, 2, (210,120,50,255))

    # 1 PM — red again
    rect(g, 13, 60, 61, 9, MEET_R2)
    rect(g, 13, 60, 61, 2, MEET_R3)
    rect(g, 14, 62, 30, 2, (190, 58,42,255))

    # Thin separator lines between blocks
    for y in [28,37,46,54,59]:
        hline(g, y, 13, 73, CAL_BG)

    # ── Notification badge (top-right, will be animated) ──
    rect(g, 65, 5, 10, 7, (200,50,40,255))    # badge bg
    rect(g, 66, 6,  8, 5, NOTIF)              # badge fill
    # "12" implied
    rect(g, 67, 7, 2, 3, (255,255,255,255))
    rect(g, 70, 7, 2, 3, (255,255,255,255))

    return grid_to_b64(g), g


# ── Scene: after_hours ────────────────────────────────────────────────────────
def scene_after_hours():
    """Night office: person hunched at desk, dual monitors glowing, dark room."""
    g = new_grid(ROOM_D)

    # Back wall
    rect(g, 0, 0, W, 50, ROOM_WALL)
    # Subtle wall texture
    for y in range(0, 50, 8):
        hline(g, y, 0, W-1, ROOM_WALL2)

    # Window (top-left, showing night sky with moon)
    rect(g, 2, 2, 24, 20, WINDOW_FR)
    rect(g, 3, 3, 22, 18, NIGHT_SKY)
    # Moon
    rect(g, 18, 5, 5, 5, MOON)
    px(g, 18, 5, (220,215,175,255)); px(g, 22, 9, (220,215,175,255))
    # Stars
    for sx, sy in [(6,5),(10,8),(14,4),(8,14),(20,13),(4,16)]:
        px(g, sx+3, sy+3, STAR_C)
    # Window frame cross
    vline(g, 14, 3, 20, WINDOW_FR)
    hline(g, 12, 3, 24, WINDOW_FR)

    # ── Desk ──
    rect(g, 0, 46, W, 5, DESK)
    hline(g, 46, 0, W-1, DESK_L)   # top highlight
    hline(g, 50, 0, W-1, DESK_EDGE)
    rect(g, 0, 51, W, 29, FLOOR)   # floor (very dark)
    rect(g, 0, 51, W, 29, (30,26,38,255))
    for y in range(53, 80, 6): hline(g, y, 0, W-1, (38,34,48,255))

    # Desk items: coffee mug (left)
    rect(g, 3, 40, 7, 7, (80,55,28,255))   # mug body
    rect(g, 4, 41, 5, 5, (100,65,30,255))  # interior
    rect(g, 4, 42, 5, 3, (50,30,10,255))   # coffee liquid
    rect(g, 9, 42, 3, 3, (70,48,22,255))   # handle
    # Steam above mug (2 wisps)
    px(g, 5, 38, (100,90,80,255)); px(g, 6, 37, (100,90,80,255))
    px(g, 7, 38, (100,90,80,255)); px(g, 8, 36, (100,90,80,255))

    # ── Main monitor (center-right) — large screen ──
    rect(g, 32, 10, 36, 28, MONITOR)       # monitor bezel
    rect(g, 33, 11, 34, 26, MONITOR_L)     # inner bezel
    rect(g, 34, 12, 32, 24, SCREEN_BLU)    # screen glow base
    # Code on screen — green/blue lines
    for row, col_c in enumerate([CODE_G, CODE_B, CODE_G, CODE_Y,
                                   CODE_DIM, CODE_G, CODE_B, CODE_DIM]):
        y_pos = 13 + row * 3
        w_var = [22, 18, 26, 14, 20, 24, 16, 12][row]
        rect(g, 35, y_pos, w_var, 2, col_c)
    # Cursor position (will be animated in SVG)
    rect(g, 56, 28, 2, 3, CODE_G)
    # Monitor stand
    rect(g, 47, 38, 5, 8, MONITOR)
    rect(g, 44, 43, 12, 3, MONITOR)
    # Screen glow spill on desk
    for dx in range(-4, 5):
        px(g, 50+dx, 46, (36, 42, 70, 255))

    # ── Small laptop (left side of desk) ──
    rect(g, 12, 26, 18, 13, MONITOR)      # screen half
    rect(g, 13, 27, 16, 11, SCREEN_BLU)   # screen
    # Laptop content
    rect(g, 14, 28, 12, 2, CODE_G)
    rect(g, 14, 31, 8, 2, CODE_B)
    rect(g, 14, 34, 10, 2, CODE_Y)
    # Hinge
    hline(g, 38, 12, 29, MONITOR)
    # Keyboard base
    rect(g, 11, 39, 20, 7, MONITOR_L)
    rect(g, 12, 40, 18, 5, (46,44,56,255))  # keycaps
    # Key rows
    for ky in range(40, 45, 2):
        for kx in range(13, 29, 3):
            px(g, kx, ky, (60,58,72,255))

    # ── Person slumped/hunched at desk ──
    cx = 55   # seated, center x
    # Chair back (implied)
    vline(g, cx+8, 28, 50, (50,40,30,255))
    # Head resting on hand, tired
    head(g, cx-4, 28, SKIN, HAIR_BL)
    # Neck
    vline(g, cx-3, 31, 33, SKIN_D)
    # Torso — hunched forward
    rect(g, cx-7, 33, 11, 9, (40,60,90,255))  # dark shirt (night mode)
    rect(g, cx-6, 34,  9, 7, (50,72,108,255))
    # Arms on desk
    rect(g, cx-7, 41, 6, 4, (45,65,95,255))  # left arm on desk
    rect(g, cx+1, 41, 6, 4, (45,65,95,255))  # right arm
    # Hands
    rect(g, cx-7, 44, 5, 3, SKIN)
    rect(g, cx+2, 44, 5, 3, SKIN)
    # Legs under desk
    rect(g, cx-5, 51, 5, 8, PANTS_BD)
    rect(g, cx+1, 51, 5, 8, PANTS_BD)

    # Screen glow on person's face
    px(g, cx-5, 28, (80, 90,130,255))
    px(g, cx-5, 29, (70, 80,120,255))

    return grid_to_b64(g), g


# ── SVG animation overlays ────────────────────────────────────────────────────
Z_GLYPH = """<g class="{cls}" transform="translate({x} {y}) scale({s})">
  <rect x="0" y="0" width="8" height="2" fill="#c0c8d4"></rect>
  <rect x="6" y="2" width="2" height="2" fill="#c0c8d4"></rect>
  <rect x="2" y="4" width="2" height="2" fill="#c0c8d4"></rect>
  <rect x="0" y="6" width="8" height="2" fill="#c0c8d4"></rect>
</g>"""

DROP_GLYPH = """<g transform="translate({x} {y})">
  <g class="scene-anim {cls}" fill="{fill}">
    <rect x="0" y="0" width="3" height="3"></rect>
    <rect x="1" y="3" width="2" height="4"></rect>
    <rect x="0" y="6" width="3" height="2"></rect>
    <rect x="4" y="1" width="2" height="2"></rect>
    <rect x="4" y="4" width="2" height="3"></rect>
  </g>
</g>"""

def stretch_art(b64):
    return (
        f'<image href="data:image/png;base64,{b64}" x="0" y="0" '
        f'width="160" height="160" image-rendering="pixelated"></image>\n'
        + Z_GLYPH.format(cls="anim-z", x=30, y=42, s=1.0) + "\n"
        + Z_GLYPH.format(cls="anim-z anim-z-2", x=94, y=38, s=0.85) + "\n"
        + Z_GLYPH.format(cls="anim-z", x=58, y=28, s=0.65)
    )

def hydrate_art(b64):
    return (
        f'<image href="data:image/png;base64,{b64}" x="0" y="0" '
        f'width="160" height="160" image-rendering="pixelated"></image>\n'
        + DROP_GLYPH.format(x=100, y=48, cls="anim-drop",   fill="#4090d8") + "\n"
        + DROP_GLYPH.format(x=112, y=44, cls="anim-drop-2", fill="#60aaec")
    )

def back_to_back_art(b64):
    badge_anim = (
        '<rect x="130" y="10" width="16" height="14" rx="3" '
        'fill="#c83228" class="anim-eye" opacity="0.85"></rect>\n'
        '<rect x="132" y="12" width="12" height="10" rx="2" '
        'fill="#f05040" class="anim-eye" opacity="0.85"></rect>\n'
        '<rect x="134" y="14" width="4" height="6" fill="white" opacity="0.9"></rect>\n'
        '<rect x="140" y="14" width="4" height="6" fill="white" opacity="0.9"></rect>'
    )
    return (
        f'<image href="data:image/png;base64,{b64}" x="0" y="0" '
        f'width="160" height="160" image-rendering="pixelated"></image>\n'
        + badge_anim
    )

def after_hours_art(b64):
    cursor = (
        '<rect x="112" y="56" width="4" height="7" '
        'fill="#48c848" class="anim-cursor" opacity="0.95"></rect>'
    )
    screen_glow = (
        '<rect x="68" y="24" width="64" height="48" '
        'fill="#1428a0" class="anim-glow" opacity="0.12" rx="2"></rect>'
    )
    laptop_glow = (
        '<rect x="26" y="54" width="36" height="22" '
        'fill="#1428a0" class="anim-glow" opacity="0.08" rx="2"></rect>'
    )
    return (
        f'<image href="data:image/png;base64,{b64}" x="0" y="0" '
        f'width="160" height="160" image-rendering="pixelated"></image>\n'
        + screen_glow + "\n" + laptop_glow + "\n" + cursor
    )


# ── Patch index.html ──────────────────────────────────────────────────────────
def patch_case(html, scene_id, new_art_inner):
    """Replace the content of art = `...` for a given case."""
    marker = f'case "{scene_id}":'
    pos = html.find(marker)
    if pos == -1:
        print(f"  WARNING: case \"{scene_id}\" not found — skipping")
        return html
    art_eq = html.find('art = `', pos)
    if art_eq == -1:
        print(f"  WARNING: art = ` not found for {scene_id} — skipping")
        return html
    open_bt = art_eq + len('art = `')
    # Find closing backtick+semicolon
    close = html.find('`;', open_bt)
    if close == -1:
        print(f"  WARNING: closing ` not found for {scene_id} — skipping")
        return html
    indented = "\n            " + new_art_inner.replace("\n", "\n            ") + "\n          "
    return html[:open_bt] + indented + html[close:]


if __name__ == "__main__":
    html_path = os.path.join(os.path.dirname(__file__), "..", "index.html")
    print(f"Reading {html_path} ...")
    with open(html_path, encoding="utf-8") as f:
        html = f.read()

    scenes = [
        ("stretch",      scene_stretch,      stretch_art),
        ("hydrate",      scene_hydrate,      hydrate_art),
        ("back_to_back", scene_back_to_back, back_to_back_art),
        ("after_hours",  scene_after_hours,  after_hours_art),
    ]

    for name, scene_fn, art_fn in scenes:
        print(f"\n[{name}]")
        b64, grid = scene_fn()
        save_preview(grid, name)
        art_inner = art_fn(b64)
        html = patch_case(html, name, art_inner)
        print(f"  patched case \"{name}\" → {len(b64)} chars base64")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\nDone. Wrote {html_path}")
