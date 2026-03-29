# ── Grid ─────────────────────────────────────────────────────────────────────
from engine.hex_grid import Hex


GRID_RADIUS = 8       # hexes from origin to edge
MAX_TURNS   = 200     # fixed match length

# ── Timing ───────────────────────────────────────────────────────────────────
TICK_DELAY  = 0.15    # default seconds per turn
TIMEOUT     = 1.0     # per-bot per-turn execution budget (seconds). Uses multiprocessing, so set to a value >= ~0.5s to account for thread overhead.

# ── Rendering ────────────────────────────────────────────────────────────────
HEX_SIZE    = 26      # pointy-top: distance from hex center to vertex (SVG px)

# Bot markers: "circles" (concentric rings) or "triangles" (point using BotData.facing)
BOT_DISPLAY_TYPE = "triangles"  # "circles" | "triangles"

# ── Colors ───────────────────────────────────────────────────────────────────
#   Player 1 = fire/orange     Player 2 = water/cyan
PLAYER_TILE_COLORS = {
    1: "#b84010",   # painted tile — deep orange
    2: "#0a7090",   # painted tile — deep cyan
}
PLAYER_BOT_COLORS = {
    1: "#ff6b2b",   # bot marker — bright orange
    2: "#00d4ff",   # bot marker — bright cyan
}
PLAYER_BRIGHT_COLORS = {
    1: "#ff8c50",   # occupied-tile highlight — P1
    2: "#22e0ff",   # occupied-tile highlight — P2
}
TILE_NONE_COLOR   = "#161f30"   # unpainted hex fill
TILE_STROKE_COLOR = "#090f1d"   # hex border
CANVAS_BG         = "#070d1a"   # SVG background

# ── Gameplay ─────────────────────────────────────────────────────────────────
# Opposite extremes on r=0 (P1 screen-left, P2 screen-right with pointy-top layout)
START_POS_1 = Hex(-(GRID_RADIUS - 1), 0)
START_POS_2 = Hex( (GRID_RADIUS - 1), 0)