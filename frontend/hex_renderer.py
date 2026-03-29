"""frontend/hex_renderer.py — Converts a GameState snapshot to an SVG string.

The returned string is a complete <svg>…</svg> element intended for injection
into a NiceGUI ui.html() element.  No external assets required.
"""
from __future__ import annotations
import math

from engine.game_state import GameState
from engine.hex_grid import axial_to_pixel, flat_hex_corners
import config


# ── Color tables ──────────────────────────────────────────────────────────────

_TILE_FILL: dict[int, str] = {
    0: config.TILE_NONE_COLOR,
    1: config.PLAYER_TILE_COLORS[1],
    2: config.PLAYER_TILE_COLORS[2],
}

_TILE_STROKE: dict[int, str] = {
    0: config.TILE_STROKE_COLOR,
    1: "#8b2e06",
    2: "#065066",
}

_BOT_FILL   = config.PLAYER_BOT_COLORS
_BOT_BRIGHT = config.PLAYER_BRIGHT_COLORS


def render_hex_grid(state: GameState, hex_size: float = 26.0) -> str:
    """Return a full <svg> string representing the current game state."""

    padding = hex_size * 1.8  # breathing room around the grid

    # ── Compute pixel centers and canvas bounds ───────────────────────────
    centers: dict = {}
    for h in state.grid:
        centers[h] = axial_to_pixel(h.q, h.r, hex_size)

    xs = [cx for cx, _ in centers.values()]
    ys = [cy for _, cy in centers.values()]
    half_w = hex_size
    half_h = hex_size * math.sqrt(3) / 2.0

    min_x = min(xs) - half_w - padding
    max_x = max(xs) + half_w + padding
    min_y = min(ys) - half_h - padding
    max_y = max(ys) + half_h + padding
    W = max_x - min_x
    H = max_y - min_y
    ox, oy = -min_x, -min_y   # offset to shift everything into positive coords

    bot_hexes: dict[int, object] = {bot.pid: bot.position for bot in state.bots.values()}
    occupied: set = set(bot_hexes.values())

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {W:.1f} {H:.1f}" width="100%" '
        f'style="display:block;background:{config.CANVAS_BG}">',
    ]

    # ── 1. Hex tiles ──────────────────────────────────────────────────────
    for h in state.grid:
        raw_cx, raw_cy = centers[h]
        cx, cy = raw_cx + ox, raw_cy + oy

        paint_pid = state.tile_pids.get(h, 0)
        is_occupied = h in occupied

        # Tiles the bot is standing on get a brighter accent fill
        if is_occupied:
            pid = next(p for p, pos in bot_hexes.items() if pos == h)
            fill   = _BOT_BRIGHT[pid]
            stroke = _TILE_STROKE[paint_pid]
            sw     = 2.0
        else:
            fill   = _TILE_FILL[paint_pid]
            stroke = _TILE_STROKE[paint_pid]
            sw     = 1.2

        corners = flat_hex_corners(cx, cy, hex_size - 0.8)
        pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in corners)
        parts.append(
            f'<polygon points="{pts}" fill="{fill}" '
            f'stroke="{stroke}" stroke-width="{sw}"/>'
        )

    # ── 2. Bot markers ────────────────────────────────────────────────────
    for bot in state.bots.values():
        if bot.position not in centers:
            continue
        raw_cx, raw_cy = centers[bot.position]
        cx, cy = raw_cx + ox, raw_cy + oy
        r_outer = hex_size * 0.40
        r_inner = hex_size * 0.20
        bot_color = _BOT_FILL[bot.pid]

        # Outer ring (white halo)
        parts.append(
            f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r_outer + 2.5:.2f}" '
            f'fill="none" stroke="white" stroke-width="2" opacity="0.6"/>'
        )
        # Body
        parts.append(
            f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r_outer:.2f}" '
            f'fill="{bot_color}"/>'
        )
        # Inner dot for depth
        parts.append(
            f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r_inner:.2f}" '
            f'fill="rgba(0,0,0,0.3)"/>'
        )
        # Player number
        fs = max(9, int(hex_size * 0.36))
        parts.append(
            f'<text x="{cx:.2f}" y="{cy:.2f}" '
            f'text-anchor="middle" dominant-baseline="central" '
            f'fill="white" font-size="{fs}" font-weight="700" '
            f'font-family="monospace" opacity="0.9">{bot.pid}</text>'
        )

    parts.append("</svg>")
    return "\n".join(parts)
