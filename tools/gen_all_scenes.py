"""
Pixel-art generator for all psych-battery activity scenes.
80x80 logical grid, SCALE=2 → 160x160 PNG.
Outputs one base64 data URI per scene to /tmp/scene_<name>.txt
"""
from PIL import Image
import base64, io, os

W, H, SCALE = 80, 80, 2

# ── shared palette ────────────────────────────────────────────────────────────
SKY       = ( 74, 120, 192, 255)
SKY_HOR   = (130, 180, 220, 255)
GRASS     = ( 58, 150,  58, 255)
GRASS_D   = ( 40, 110,  40, 255)
WALL      = (200, 190, 175, 255)
WALL_D    = (175, 162, 145, 255)
FLOOR     = (180, 155, 120, 255)
FLOOR_D   = (155, 130,  95, 255)
WOOD      = (140,  96,  54, 255)
WOOD_L    = (180, 130,  80, 255)
ROOM_D    = ( 30,  28,  40, 255)  # dark room (night)
ROOM_WALL = ( 45,  40,  60, 255)
MOON      = (240, 235, 190, 255)
STAR_C    = (220, 220, 180, 255)
NIGHT_SKY = ( 18,  18,  40, 255)
SKIN      = (220, 168, 112, 255)
SKIN_D    = (185, 130,  80, 255)
HAIR_BR   = ( 70,  45,  20, 255)
HAIR_BL   = ( 30,  20,  15, 255)
SHIRT_T   = ( 64, 160, 200, 255)  # teal
SHIRT_O   = (210, 100,  50, 255)  # orange
SHIRT_P   = (130,  80, 200, 255)  # purple
SHIRT_G   = ( 60, 170,  80, 255)  # green
SHIRT_W   = (220, 220, 220, 255)  # white/light
PANTS_B   = ( 60,  80, 160, 255)
PANTS_G   = ( 70,  90,  70, 255)
SHOE      = ( 50,  40,  30, 255)
SHEET     = (200, 210, 230, 255)
SHEET_D   = (160, 175, 205, 255)
PILLOW    = (235, 220, 200, 255)
PILLOW_D  = (205, 188, 165, 255)
BLANKET   = ( 80, 120, 180, 255)
BLANKET_D = ( 55,  88, 145, 255)
MONITOR   = ( 30,  30,  38, 255)
SCREEN    = (  8,  16,  28, 255)
SCREEN_GL = ( 20,  60, 100, 255)
CODE_G    = ( 80, 200,  80, 255)
CODE_B    = ( 80, 160, 230, 255)
CODE_Y    = (230, 200,  60, 255)
CODE_P    = (200, 100, 220, 255)
DESK      = (160, 115,  65, 255)
DESK_D    = (120,  82,  42, 255)
DESK_L    = (190, 145,  90, 255)
WOOD_D    = (110,  72,  32, 255)
LEAF      = ( 36, 128,  36, 255)
LEAF_L    = ( 64, 160,  64, 255)
COFFEE    = (100,  64,  28, 255)
COFFEE_RIM= (200, 140,  70, 255)
STEAM     = (190, 195, 210, 255)
PLATE     = (240, 235, 225, 255)
PLATE_D   = (210, 200, 185, 255)
FOOD_R    = (210,  70,  50, 255)  # red food
FOOD_G    = ( 80, 175,  70, 255)  # green food
FOOD_Y    = (230, 200,  60, 255)  # yellow food
FORK_C    = (180, 185, 195, 255)
BUBBLE    = (240, 245, 255, 255)
BUBBLE_D  = (200, 210, 230, 255)
NOTIF     = (240,  80,  60, 255)
NOTIF_Y   = (240, 200,  50, 255)
NOTIF_B   = ( 80, 140, 230, 255)
HEAD_PHONE= ( 40,  40,  50, 255)
GLOW      = ( 80, 170, 255, 255)  # monitor glow

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

def grid_to_png_b64(grid):
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

def person_stand(g, px0, y0, shirt, pants, skin=SKIN, hair=HAIR_BR, face_right=True):
    """Draw a standing person at top-left (px0, y0). ~7px wide, 16px tall."""
    # head 3x3
    rect(g, px0+1, y0,   3, 3, skin)
    # hair
    hline(g, y0, px0+1, px0+3, hair)
    px(g, px0+1, y0+1, hair)
    # eye
    ex = px0+3 if face_right else px0+1
    px(g, ex, y0+1, (40,30,20,255))
    # body
    rect(g, px0, y0+3, 5, 5, shirt)
    # arms
    px(g, px0-1, y0+3, shirt); px(g, px0-1, y0+4, shirt)  # left arm
    px(g, px0+5, y0+4, shirt); px(g, px0+5, y0+5, shirt)  # right arm
    # legs
    rect(g, px0, y0+8, 2, 5, pants)
    rect(g, px0+3, y0+8, 2, 5, pants)
    # shoes
    rect(g, px0-1, y0+13, 3, 2, SHOE)
    rect(g, px0+3, y0+13, 3, 2, SHOE)

def person_sit(g, px0, y0, shirt, pants, skin=SKIN, hair=HAIR_BR):
    """Seated person – torso up + lap/thighs horizontal."""
    # head
    rect(g, px0+1, y0, 3, 3, skin)
    hline(g, y0, px0+1, px0+3, hair)
    px(g, px0+3, y0+1, (40,30,20,255))  # eye
    # torso
    rect(g, px0, y0+3, 5, 6, shirt)
    # arms (resting forward on desk)
    rect(g, px0-1, y0+3, 2, 3, skin)
    rect(g, px0+5, y0+3, 2, 3, skin)
    # thighs horizontal
    rect(g, px0, y0+9, 7, 3, pants)

# ════════════════════════════════════════════════════════════════════════
# Scene 1: connect_people
# Two people at a round/small café table, speech bubble between them
# ════════════════════════════════════════════════════════════════════════
def scene_connect_people():
    g = new_grid(WALL)
    # floor
    rect(g, 0, 54, W, 26, FLOOR)
    hline(g, 54, 0, W-1, FLOOR_D)
    # wall detail: baseboard
    hline(g, 55, 0, W-1, WALL_D)
    hline(g, 56, 0, W-1, WALL_D)
    # window frame top-left
    rect(g, 5, 4, 20, 24, WALL_D)
    rect(g, 6, 5, 18, 22, SKY)
    rect(g, 6, 14, 18, 2, WALL_D)  # crossbar
    rect(g, 14, 5, 2, 22, WALL_D)  # center post
    # outdoor scene through window
    hline(g, 20, 7, 12, GRASS)
    hline(g, 21, 7, 12, GRASS)
    px(g, 9, 8, (252,212,40,255))  # tiny sun
    px(g, 10, 8, (252,212,40,255))
    px(g, 9, 9, (252,212,40,255))
    px(g, 10, 9, (252,212,40,255))
    # picture on wall (right side)
    rect(g, 52, 8, 22, 16, WALL_D)
    rect(g, 53, 9, 20, 14, (80,120,160,255))
    rect(g, 56, 12, 5, 5, (200,180,120,255))
    rect(g, 64, 10, 6, 8, (140,180,130,255))
    # table (round-ish, center)
    rect(g, 28, 50, 24, 6, WOOD)
    hline(g, 50, 28, 51, WOOD_L)
    rect(g, 36, 56, 8, 16, WOOD_D)  # pedestal
    rect(g, 32, 70, 16, 4, WOOD_D)  # base
    # coffee cups on table
    rect(g, 30, 44, 4, 5, COFFEE)
    hline(g, 44, 30, 33, COFFEE_RIM)
    px(g, 34, 46, COFFEE)
    rect(g, 46, 44, 4, 5, COFFEE)
    hline(g, 44, 46, 49, COFFEE_RIM)
    px(g, 45, 46, COFFEE)
    # person left (orange shirt, facing right)
    person_stand(g, 9, 30, SHIRT_O, PANTS_B, face_right=True)
    # person right (purple shirt, facing left)
    person_stand(g, 62, 30, SHIRT_P, PANTS_G, face_right=False)
    # speech bubble between them
    rect(g, 22, 18, 36, 14, BUBBLE)
    rect(g, 23, 17, 34, 16, BUBBLE)
    hline(g, 17, 23, 56, BUBBLE_D)
    hline(g, 32, 23, 56, BUBBLE_D)
    vline(g, 22, 18, 31, BUBBLE_D)
    vline(g, 57, 18, 31, BUBBLE_D)
    # bubble tail pointing right (toward right person)
    rect(g, 50, 32, 5, 3, BUBBLE)
    px(g, 53, 35, BUBBLE)
    px(g, 52, 36, BUBBLE)
    # text lines inside bubble
    hline(g, 21, 26, 52, BUBBLE_D)
    hline(g, 24, 26, 46, BUBBLE_D)
    hline(g, 27, 26, 50, BUBBLE_D)
    hline(g, 30, 26, 44, BUBBLE_D)
    return grid_to_png_b64(g), g

# ════════════════════════════════════════════════════════════════════════
# Scene 2: eat_food
# Person at dining table, plate of food, fork, steam
# ════════════════════════════════════════════════════════════════════════
def scene_eat_food():
    g = new_grid(WALL)
    rect(g, 0, 52, W, 28, FLOOR)
    hline(g, 52, 0, W-1, FLOOR_D)
    hline(g, 53, 0, W-1, WALL_D)
    # window
    rect(g, 8, 5, 18, 20, WALL_D)
    rect(g, 9, 6, 16, 18, SKY_HOR)
    rect(g, 9, 14, 16, 2, WALL_D)
    rect(g, 16, 6, 2, 18, WALL_D)
    hline(g, 18, 10, 14, GRASS)
    hline(g, 19, 10, 14, GRASS)
    # table top
    rect(g, 14, 48, 58, 6, WOOD_L)
    hline(g, 48, 14, 71, WOOD)
    rect(g, 14, 54, 4, 22, WOOD)  # left leg
    rect(g, 68, 54, 4, 22, WOOD)  # right leg
    hline(g, 53, 14, 71, WOOD_D)
    # plate (oval-ish)
    rect(g, 36, 38, 20, 12, PLATE)
    rect(g, 34, 40, 24, 8, PLATE)
    hline(g, 38, 34, 57, PLATE_D)
    hline(g, 49, 34, 57, PLATE_D)
    # food on plate: steak-like + veggies
    rect(g, 38, 40, 10, 6, FOOD_R)    # protein
    rect(g, 40, 41, 6, 4, (180,50,30,255))  # darker center
    rect(g, 50, 41, 6, 4, FOOD_G)     # greens
    rect(g, 52, 39, 4, 2, (120,220,90,255))
    rect(g, 37, 42, 4, 3, FOOD_Y)     # yellow (corn?)
    # fork (left of plate)
    rect(g, 30, 38, 2, 12, FORK_C)
    rect(g, 28, 38, 6, 2, FORK_C)
    px(g, 28, 40, FORK_C); px(g, 32, 40, FORK_C); px(g, 34, 40, FORK_C)
    # knife (right)
    rect(g, 58, 38, 2, 14, FORK_C)
    rect(g, 58, 38, 4, 3, FORK_C)
    # coffee mug (right side of table)
    rect(g, 64, 36, 8, 10, COFFEE)
    hline(g, 36, 64, 71, COFFEE_RIM)
    rect(g, 72, 39, 3, 5, COFFEE)  # handle
    rect(g, 65, 38, 6, 2, (160,100,40,255))  # liquid
    # steam above mug
    for i in range(3):
        px(g, 67+i*2, 32, STEAM)
        px(g, 67+i*2, 30, STEAM)
    # person sitting at table (left side)
    person_sit(g, 14, 28, SHIRT_T, PANTS_B)
    # their arm forward onto table
    rect(g, 20, 43, 10, 3, SKIN)
    rect(g, 20, 43, 4, 3, SHIRT_T)
    return grid_to_png_b64(g), g

# ════════════════════════════════════════════════════════════════════════
# Scene 3: take_nap
# Dark bedroom, person in bed, window with moon
# ════════════════════════════════════════════════════════════════════════
def scene_take_nap():
    g = new_grid(ROOM_D)
    # floor
    rect(g, 0, 62, W, 18, (55, 45, 35, 255))
    # walls
    rect(g, 0, 0, W, 62, (38, 34, 52, 255))
    # window (upper right) showing night sky
    rect(g, 50, 5, 26, 30, (25,22,40,255))
    rect(g, 51, 6, 24, 28, NIGHT_SKY)
    rect(g, 51, 19, 24, 2, (35,30,50,255))  # crossbar
    rect(g, 62, 6, 2, 28, (35,30,50,255))   # center
    # moon in window
    rect(g, 66, 8, 6, 6, MOON)
    rect(g, 70, 8, 4, 3, NIGHT_SKY)  # crescent shadow
    # stars in window
    for sx, sy in [(54,9),(58,12),(57,22),(72,22),(53,24)]:
        px(g, sx, sy, STAR_C)
    # curtains (sides of window)
    rect(g, 48, 5, 4, 32, (100, 60, 80, 255))
    rect(g, 74, 5, 4, 32, (100, 60, 80, 255))
    # small lamp on nightstand
    rect(g, 6, 46, 10, 16, (80,70,55,255))  # nightstand
    rect(g, 8, 36, 6, 10, (220,180,80,255)) # lamp shade
    px(g, 11, 45, (255,230,150,255))         # warm glow
    px(g, 10, 45, (255,230,150,255))
    px(g, 12, 44, (255,220,130,255))
    for lx, ly in [(8,44),(7,45),(8,46),(13,44),(14,45),(13,46)]:
        px(g, lx, ly, (255,220,100,180))
    # BED: headboard
    rect(g, 8, 44, 64, 8, (90,70,50,255))
    rect(g, 9, 45, 62, 6, (110,85,60,255))
    rect(g, 12, 46, 56, 4, (130,100,70,255))
    # mattress
    rect(g, 8, 52, 64, 12, SHEET)
    hline(g, 52, 8, 71, SHEET_D)
    # pillow
    rect(g, 12, 48, 18, 8, PILLOW)
    rect(g, 13, 49, 16, 6, PILLOW_D)
    hline(g, 50, 13, 28, PILLOW)
    # blanket (over lower body)
    rect(g, 8, 58, 64, 8, BLANKET)
    rect(g, 8, 58, 64, 2, BLANKET_D)
    hline(g, 60, 8, 71, (100, 145, 210, 255))
    hline(g, 62, 8, 71, (100, 145, 210, 255))
    # person lying down (head on pillow, body under blanket)
    # head (on pillow)
    rect(g, 14, 48, 6, 6, SKIN)
    hline(g, 48, 14, 19, HAIR_BR)
    hline(g, 49, 14, 15, HAIR_BR)
    px(g, 18, 50, (40,30,20,255))  # closed eye (line)
    px(g, 19, 50, (40,30,20,255))
    # slight smile
    px(g, 17, 52, SKIN_D)
    px(g, 18, 53, SKIN_D)
    px(g, 19, 52, SKIN_D)
    # bedside glass of water (right)
    rect(g, 66, 43, 5, 8, (140,190,220,100))
    rect(g, 66, 43, 5, 2, (180,220,240,150))
    vline(g, 66, 43, 51, (100,160,200,255))
    vline(g, 70, 43, 51, (100,160,200,255))
    # baseboards
    hline(g, 62, 0, W-1, (70,58,44,255))
    return grid_to_png_b64(g), g

# ════════════════════════════════════════════════════════════════════════
# Scene 4: zoom_meeting
# Person at desk, monitor showing 2x2 face grid, REC dot
# ════════════════════════════════════════════════════════════════════════
def scene_zoom_meeting():
    g = new_grid(WALL)
    rect(g, 0, 54, W, 26, FLOOR)
    hline(g, 54, 0, W-1, FLOOR_D)
    hline(g, 55, 0, W-1, WALL_D)
    # desk
    rect(g, 10, 50, 60, 5, DESK_L)
    hline(g, 50, 10, 69, DESK)
    rect(g, 10, 55, 5, 20, DESK)
    rect(g, 65, 55, 5, 20, DESK)
    # monitor frame
    rect(g, 20, 14, 40, 28, MONITOR)
    rect(g, 21, 15, 38, 26, SCREEN)
    # zoom grid: 4 face tiles (2x2) on screen
    face_cols = [(22,40),(42,60)]
    face_rows = [(16,25),(27,36)]
    face_colors = [
        (200,160,110,255), (240,200,160,255),
        (160,120, 80,255), (210,170,120,255),
    ]
    fc_backgrounds = [
        ( 40, 40, 60,255), (30, 50, 40,255),
        ( 50, 30, 30,255), (30, 30, 60,255),
    ]
    i = 0
    for r0, r1 in face_rows:
        for c0, c1 in face_cols:
            rect(g, c0, r0, c1-c0, r1-r0, fc_backgrounds[i])
            # tiny face
            mid_x = (c0+c1)//2 - 2
            mid_y = (r0+r1)//2 - 3
            rect(g, mid_x, mid_y, 4, 4, face_colors[i])
            # shirt color
            rect(g, mid_x-1, mid_y+4, 6, 3, [SHIRT_T,SHIRT_O,SHIRT_P,SHIRT_G][i])
            i += 1
    # grid dividers
    hline(g, 26, 22, 59, (60,60,80,255))
    vline(g, 41, 16, 35, (60,60,80,255))
    # REC dot (top right of screen)
    rect(g, 53, 16, 4, 3, (200,40,40,255))
    px(g, 55, 17, (255,80,80,255))
    # camera on top of monitor
    rect(g, 38, 12, 4, 3, (50,50,60,255))
    px(g, 40, 13, (30,30,40,255))
    # monitor neck + base
    rect(g, 38, 42, 4, 8, MONITOR)
    rect(g, 32, 49, 16, 3, MONITOR)
    # person sitting at desk (left of center, facing monitor)
    person_sit(g, 12, 32, SHIRT_T, PANTS_B)
    # keyboard on desk
    rect(g, 22, 48, 20, 3, (160,165,175,255))
    hline(g, 49, 22, 41, (140,145,155,255))
    # subtle screen glow on person's face
    px(g, 14, 34, (200,220,255,255))
    px(g, 15, 33, (200,220,255,255))
    return grid_to_png_b64(g), g

# ════════════════════════════════════════════════════════════════════════
# Scene 5: heavy_async
# Person at desk, overwhelmed, notification bubbles everywhere
# ════════════════════════════════════════════════════════════════════════
def scene_heavy_async():
    g = new_grid(WALL)
    rect(g, 0, 54, W, 26, FLOOR)
    hline(g, 54, 0, W-1, FLOOR_D)
    hline(g, 55, 0, W-1, WALL_D)
    # desk
    rect(g, 8, 50, 62, 5, DESK_L)
    hline(g, 50, 8, 69, DESK)
    rect(g, 8, 55, 5, 22, DESK)
    rect(g, 65, 55, 5, 22, DESK)
    # monitor (tilted look with content)
    rect(g, 24, 16, 34, 24, MONITOR)
    rect(g, 25, 17, 32, 22, SCREEN)
    # chaotic emails/messages on screen (random lines)
    for row_y, row_x0, row_w, col in [
        (19,27,14,CODE_G),(19,43,10,(200,60,60,255)),
        (22,27,20,SHEET_D),(22,49, 6,NOTIF_Y),
        (25,27,10,(200,60,60,255)),(25,39,14,CODE_B),
        (28,27,24,SHEET_D),(28,53, 4,NOTIF),
        (31,27,18,CODE_Y),(31,47,10,CODE_G),
        (34,27, 8,NOTIF),(34,37,16,SHEET_D),
    ]:
        hline(g, row_y, row_x0, row_x0+row_w, col)
    # monitor neck + base
    rect(g, 38, 40, 4, 10, MONITOR)
    rect(g, 32, 49, 16, 3, MONITOR)
    # phone on desk (right)
    rect(g, 60, 38, 8, 14, MONITOR)
    rect(g, 61, 39, 6, 12, SCREEN)
    # phone notifications
    rect(g, 62, 41, 4, 3, NOTIF)
    px(g, 63, 42, (255,100,80,255))
    hline(g, 45, 62, 67, CODE_B)
    hline(g, 47, 62, 65, SHEET_D)
    # notification bubbles floating around (red, yellow, blue)
    def notif_bubble(g, bx, by, col, badge):
        rect(g, bx, by, 8, 7, col)
        rect(g, bx+1, by-1, 6, 9, col)
        hline(g, by+7, bx+3, bx+5, col)  # tail
        px(g, bx+4, by+8, col)
        # badge text (bright pixel)
        px(g, bx+3, by+2, (255,255,255,255))
        px(g, bx+4, by+2, (255,255,255,255))
        px(g, bx+4, by+3, (255,255,255,255))
        px(g, bx+4, by+4, (255,255,255,255))

    notif_bubble(g, 4,  8, NOTIF, "!")
    notif_bubble(g, 62,  6, NOTIF_Y, "3")
    notif_bubble(g, 4, 26, NOTIF_B, "5")
    notif_bubble(g, 64, 22, NOTIF, "!")
    # small badge circles
    rect(g, 17, 12, 5, 5, NOTIF)
    px(g, 19, 14, (255,255,255,255))
    rect(g, 52, 10, 5, 5, NOTIF_Y)
    px(g, 54, 12, (255,255,255,255))
    # person sitting at desk (stressed posture - head in hands)
    # body
    person_sit(g, 14, 30, SHIRT_O, PANTS_B)
    # hands up near face (stressed)
    rect(g, 12, 27, 3, 3, SKIN)
    rect(g, 20, 27, 3, 3, SKIN)
    return grid_to_png_b64(g), g

# ════════════════════════════════════════════════════════════════════════
# Scene 6: deep_work
# Person at desk, headphones, monitor with code, focused/calm
# ════════════════════════════════════════════════════════════════════════
def scene_deep_work():
    g = new_grid(WALL)
    # slightly darker/cooler wall for focus
    rect(g, 0, 0, W, W, (185, 178, 168, 255))
    rect(g, 0, 54, W, 26, FLOOR)
    hline(g, 54, 0, W-1, FLOOR_D)
    hline(g, 55, 0, W-1, WALL_D)
    # small bookshelf top-left
    rect(g, 4, 8, 16, 32, (140,100,65,255))
    for shelf in [12, 20, 28]:
        hline(g, shelf, 4, 19, (100,70,40,255))
    # books
    BOOKS = [(200,60,60,255),(60,120,200,255),(200,180,60,255),
             (60,180,80,255),(180,60,200,255),(60,180,180,255)]
    bx = 5
    for bi, bc in enumerate(BOOKS):
        row_y = 13 + (bi//3)*8
        col_x = 5 + (bi%3)*4
        rect(g, col_x, row_y, 3, 6, bc)
    # plant top-right
    rect(g, 68, 36, 6, 16, (120,80,44,255))  # pot
    rect(g, 69, 37, 4, 4, (80,120,60,255))   # soil
    rect(g, 66, 28, 4, 10, GRASS)
    rect(g, 70, 24, 6, 12, (80,170,60,255))
    rect(g, 68, 22, 8, 8, LEAF)
    rect(g, 72, 20, 4, 6, (100,200,80,255))
    # desk
    rect(g, 12, 50, 56, 5, DESK_L)
    hline(g, 50, 12, 67, DESK)
    rect(g, 12, 55, 5, 22, DESK)
    rect(g, 63, 55, 5, 22, DESK)
    # monitor
    rect(g, 22, 14, 36, 26, MONITOR)
    rect(g, 23, 15, 34, 24, SCREEN)
    # code on screen (neat, structured)
    code_lines = [
        (17,25,18,CODE_G),(17,45,8, CODE_B),
        (20,25,6, CODE_P),(20,33,10,CODE_G),(20,45,8, SHEET_D),
        (23,27,20,CODE_B),(23,49,4, CODE_Y),
        (26,25,6, CODE_G),(26,33,14,SHEET_D),
        (29,25,22,CODE_B),
        (32,25,4, CODE_Y),(32,31,12,CODE_G),(32,45,8, SHEET_D),
        (35,27,18,CODE_P),(35,47,6, CODE_B),
    ]
    for ly, lx, lw, lc in code_lines:
        hline(g, ly, lx, lx+lw, lc)
    # cursor blink (bright block)
    rect(g, 47, 35, 2, 3, (180,220,255,255))
    # monitor neck + base
    rect(g, 38, 40, 4, 10, MONITOR)
    rect(g, 30, 49, 20, 3, MONITOR)
    # keyboard
    rect(g, 24, 48, 22, 3, (155,160,170,255))
    hline(g, 49, 24, 45, (135,140,150,255))
    # mouse
    rect(g, 50, 47, 5, 5, (155,160,170,255))
    rect(g, 52, 47, 2, 2, (120,125,135,255))
    # coffee mug (left of keyboard)
    rect(g, 16, 40, 6, 10, COFFEE)
    hline(g, 40, 16, 21, COFFEE_RIM)
    rect(g, 22, 42, 3, 5, COFFEE)  # handle
    # steam
    px(g, 18, 37, STEAM); px(g, 20, 36, STEAM); px(g, 19, 35, STEAM)
    # person with headphones
    # body
    person_sit(g, 14, 30, SHIRT_W, PANTS_G)
    # headphone arc
    rect(g, 14, 27, 12, 2, HEAD_PHONE)
    rect(g, 14, 27, 3, 5, HEAD_PHONE)  # left cup
    rect(g, 23, 27, 3, 5, HEAD_PHONE)  # right cup
    # screen glow on face (subtle blue tint)
    px(g, 16, 32, (210,225,250,255))
    px(g, 17, 31, (210,225,250,255))
    return grid_to_png_b64(g), g

# ════════════════════════════════════════════════════════════════════════
# Scene 7: late_night_ai
# Dark room, night, person at monitor, moon visible through window
# ════════════════════════════════════════════════════════════════════════
def scene_late_night_ai():
    g = new_grid(ROOM_D)
    rect(g, 0, 0, W, 80, (22, 20, 32, 255))  # dark room wall
    rect(g, 0, 60, W, 20, (30, 25, 20, 255))  # floor
    hline(g, 60, 0, W-1, (42, 36, 28, 255))
    # window (left side, night view)
    rect(g, 4, 6, 24, 30, (30,26,44,255))
    rect(g, 5, 7, 22, 28, NIGHT_SKY)
    rect(g, 5, 20, 22, 2, (38,32,52,255))
    rect(g, 15, 7, 2, 28, (38,32,52,255))
    # moon in window
    rect(g, 18, 9, 8, 8, MOON)
    rect(g, 23, 9, 5, 5, NIGHT_SKY)  # crescent
    # stars
    for sx, sy in [(7,10),(12,14),(8,25),(20,24),(6,18),(22,18)]:
        px(g, sx, sy, STAR_C)
        px(g, sx, sy, STAR_C)
    # curtains (hanging down)
    rect(g, 2, 6, 4, 32, (80,50,70,255))
    rect(g, 26, 6, 4, 32, (80,50,70,255))
    # desk
    rect(g, 18, 50, 58, 5, (100,72,44,255))
    hline(g, 50, 18, 75, (80,55,32,255))
    rect(g, 18, 55, 5, 24, (80,55,32,255))
    rect(g, 71, 55, 5, 24, (80,55,32,255))
    # monitor (large, centered-right)
    rect(g, 36, 16, 36, 26, (25,25,32,255))
    rect(g, 37, 17, 34, 24, SCREEN)
    # screen content: AI chat interface
    # top bar
    rect(g, 37, 17, 34, 3, (30,50,80,255))
    # chat bubbles
    # user bubble (right-aligned, dark)
    rect(g, 52, 21, 16, 5, (40,60,100,255))
    rect(g, 53, 22, 14, 3, (60,80,120,255))
    # AI bubble (left-aligned, green-tinted)
    rect(g, 38, 27, 16, 5, (20,60,50,255))
    rect(g, 39, 28, 14, 3, (30,80,65,255))
    # another user bubble
    rect(g, 50, 33, 18, 5, (40,60,100,255))
    rect(g, 51, 34, 16, 3, (60,80,120,255))
    # cursor at bottom
    rect(g, 38, 38, 20, 2, (30,40,60,255))
    rect(g, 38, 38, 2, 2, (100,180,255,255))
    # monitor glow (blue-white spill on desk and person)
    for gx in range(36, 72):
        alpha_val = max(0, 40 - abs(gx - 54) * 2)
        if alpha_val > 0:
            px(g, gx, 42, (GLOW[0], GLOW[1], GLOW[2], alpha_val))
            px(g, gx, 43, (GLOW[0]//2, GLOW[1]//2, GLOW[2]//2, alpha_val//2))
    # monitor neck + base
    rect(g, 50, 42, 4, 8, (25,25,32,255))
    rect(g, 44, 49, 16, 3, (25,25,32,255))
    # webcam on top
    rect(g, 52, 14, 4, 3, (35,35,45,255))
    px(g, 54, 15, (20,20,30,255))
    # person sitting (right of center, lit by screen)
    # body in dark room, blue-lit face
    px0, y0 = 28, 32
    # head lit by screen glow
    rect(g, px0+1, y0, 3, 3, (190,200,220,255))  # blue-tinted skin
    hline(g, y0, px0+1, px0+3, (50,40,30,255))
    px(g, px0+3, y0+1, (40,50,70,255))  # eye (tired)
    px(g, px0+2, y0+1, (40,50,70,255))
    # body
    rect(g, px0, y0+3, 5, 6, (40,50,80,255))  # dark hoodie
    rect(g, px0-1, y0+3, 2, 3, (40,50,80,255))
    rect(g, px0+5, y0+3, 2, 3, (40,50,80,255))
    # thighs
    rect(g, px0, y0+9, 7, 3, (30,35,55,255))
    # coffee mug on desk (right of monitor)
    rect(g, 72, 40, 6, 10, (70,50,30,255))
    hline(g, 40, 72, 77, (160,110,60,255))
    rect(g, 78, 43, 3, 5, (70,50,30,255))  # handle
    # steam (faint, night)
    px(g, 74, 37, (100,100,110,255))
    px(g, 76, 36, (100,100,110,255))
    px(g, 75, 35, (100,100,110,255))
    # keyboard
    rect(g, 36, 48, 22, 3, (40,42,55,255))
    hline(g, 49, 36, 57, (30,32,45,255))
    return grid_to_png_b64(g), g

# ════════════════════════════════════════════════════════════════════════
# Run all scenes
# ════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    scenes = {
        "connect_people": scene_connect_people,
        "eat_food":        scene_eat_food,
        "take_nap":        scene_take_nap,
        "zoom_meeting":    scene_zoom_meeting,
        "heavy_async":     scene_heavy_async,
        "deep_work":       scene_deep_work,
        "late_night_ai":   scene_late_night_ai,
    }
    for name, fn in scenes.items():
        print(f"Generating {name}...")
        b64, grid = fn()
        with open(f"/tmp/scene_{name}.txt", "w") as f:
            f.write(b64)
        save_preview(grid, name)
        print(f"  -> /tmp/scene_{name}.txt ({len(b64)} bytes b64)")
    print("All done.")
