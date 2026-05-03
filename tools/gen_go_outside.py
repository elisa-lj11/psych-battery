"""
Pixel-art generator for the go_outside scene.
80×80 logical grid; each logical pixel = 2×2 real pixels → 160×160 PNG output.
Outputs a base64 data URI to stdout.
"""
from PIL import Image
import base64, io

W, H = 80, 80
SCALE = 2

# ── palette ──────────────────────────────────────────────────────────────────
SKY      = (  74, 120, 192, 255)
SKY_HOR  = ( 130, 180, 220, 255)  # lighter near horizon
GRASS    = (  58, 150,  58, 255)
GRASS_D  = (  40, 110,  40, 255)  # darker grass accent
DIRT     = ( 172, 140,  96, 255)
PATH     = ( 200, 170, 120, 255)
TRUNK    = ( 100,  64,  24, 255)
LEAF     = (  36, 128,  36, 255)
LEAF_L   = (  64, 160,  64, 255)  # lighter leaf highlight
SUN      = ( 252, 212,  40, 255)
SUN_GLOW = ( 255, 240, 120, 255)
CLOUD    = ( 220, 232, 248, 255)
CLOUD_D  = ( 180, 200, 230, 255)
BIRD     = (  30,  50, 100, 255)
# person
SKIN     = ( 220, 168, 112, 255)
SHIRT    = (  64, 160, 200, 255)  # teal shirt
PANTS    = (  60,  80, 160, 255)
SHOE     = (  50,  40,  30, 255)
HAIR     = (  70,  45,  20, 255)

TRANSPARENT = (0, 0, 0, 0)

grid = [[SKY] * W for _ in range(H)]

def px(x, y, color):
    if 0 <= x < W and 0 <= y < H:
        grid[y][x] = color

def rect(x, y, w, h, color):
    for dy in range(h):
        for dx in range(w):
            px(x + dx, y + dy, color)

def hline(y, x0, x1, color):
    for x in range(x0, x1 + 1):
        px(x, y, color)

# ── sky gradient (3 bands) ───────────────────────────────────────────────────
rect(0, 0, W, 42, SKY)
rect(0, 42, W, 6, SKY_HOR)

# ── sun (top-right) ──────────────────────────────────────────────────────────
# glow halo
for dy in range(-1, 9):
    for dx in range(-1, 9):
        if 0 <= dx <= 7 and 0 <= dy <= 7:
            px(62 + dx, 4 + dy, SUN_GLOW)
# core
rect(63, 5, 6, 6, SUN)

# ── cloud 1 (left-center sky) ────────────────────────────────────────────────
# bottom row shadow
hline(26, 8, 24, CLOUD_D)
# main cloud
rect(10, 20, 14, 6, CLOUD)
rect(8,  22, 18, 4, CLOUD)
rect(14, 18, 8,  4, CLOUD)

# ── cloud 2 (mid sky) ────────────────────────────────────────────────────────
hline(18, 38, 50, CLOUD_D)
rect(40, 13, 10, 4, CLOUD)
rect(38, 15, 14, 4, CLOUD)
rect(44, 11, 6,  4, CLOUD)

# ── birds (3 simple V shapes) ────────────────────────────────────────────────
# bird 1
px(50, 8, BIRD); px(51, 7, BIRD); px(52, 8, BIRD)
# bird 2
px(56, 12, BIRD); px(57, 11, BIRD); px(58, 12, BIRD)
# bird 3
px(30, 10, BIRD); px(31,  9, BIRD); px(32, 10, BIRD)

# ── grass strip (rows 48–54) ─────────────────────────────────────────────────
rect(0, 48, W, 6, GRASS)
# darker accent row at top
hline(48, 0, W - 1, GRASS_D)
# jagged top edge for grass blades
for x in range(0, W, 3):
    px(x, 47, GRASS)
for x in range(1, W, 4):
    px(x, 46, GRASS)

# ── ground (rows 54–79) ──────────────────────────────────────────────────────
rect(0, 54, W, 26, DIRT)

# ── path (centre strip) ──────────────────────────────────────────────────────
rect(32, 54, 16, 26, PATH)
# path highlights
hline(55, 34, 45, (220, 192, 144, 255))
hline(60, 34, 45, (220, 192, 144, 255))
hline(65, 34, 45, (220, 192, 144, 255))
hline(70, 34, 45, (220, 192, 144, 255))

# ── left tree ────────────────────────────────────────────────────────────────
# trunk
rect(8, 40, 4, 14, TRUNK)
# leaves (roughly triangular, 3 tiers)
rect(2, 28, 16, 6, LEAF)
rect(4, 22, 12, 8, LEAF)
rect(6, 16, 8,  8, LEAF)
# highlights
rect(6, 29, 4, 2, LEAF_L)
rect(7, 23, 3, 2, LEAF_L)

# ── right tree ───────────────────────────────────────────────────────────────
# trunk
rect(67, 40, 4, 14, TRUNK)
# leaves
rect(60, 28, 18, 6, LEAF)
rect(62, 22, 14, 8, LEAF)
rect(64, 16, 10, 8, LEAF)
# highlights
rect(64, 29, 4, 2, LEAF_L)
rect(65, 23, 3, 2, LEAF_L)

# ── person (walking, center-left of path, x≈36, y≈36) ───────────────────────
# head
rect(37, 34, 4, 4, SKIN)
px(38, 33, HAIR); px(39, 33, HAIR); px(37, 33, HAIR)  # hair
# body (shirt)
rect(36, 38, 6, 6, SHIRT)
# left arm (swinging forward)
rect(34, 38, 2, 5, SHIRT)
# right arm (swinging back)
rect(42, 39, 2, 4, SHIRT)
# legs
rect(37, 44, 2, 5, PANTS)  # left leg
rect(40, 44, 2, 5, PANTS)  # right leg (slightly staggered = walking)
# shoes
rect(37, 48, 3, 2, SHOE)   # left
rect(40, 47, 3, 2, SHOE)   # right (forward step)
# shadow under person
for dx in range(6):
    px(36 + dx, 50, GRASS_D)

# ── scale up 2× and write PNG ────────────────────────────────────────────────
img = Image.new("RGBA", (W * SCALE, H * SCALE))
pix = img.load()
for y in range(H):
    for x in range(W):
        c = grid[y][x]
        for sy in range(SCALE):
            for sx in range(SCALE):
                pix[x * SCALE + sx, y * SCALE + sy] = c

buf = io.BytesIO()
img.save(buf, format="PNG", optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()
print(f"data:image/png;base64,{b64}")
