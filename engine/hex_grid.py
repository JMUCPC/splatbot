"""engine/hex_grid.py — Axial-coordinate hex grid utilities.

Uses flat-top hexagon orientation throughout.
Reference: https://www.redblobgames.com/grids/hexagons/
"""
from __future__ import annotations
from dataclasses import dataclass
import math


@dataclass(frozen=True)
class Hex:
    """Axial (q, r) hex coordinate. Immutable and hashable."""
    q: int
    r: int

    def __add__(self, other: Hex) -> Hex:
        return Hex(self.q + other.q, self.r + other.r)

    def __sub__(self, other: Hex) -> Hex:
        return Hex(self.q - other.q, self.r - other.r)

    def __repr__(self) -> str:
        return f"Hex({self.q}, {self.r})"


# The 6 axial direction vectors (flat-top, clockwise from east)
HEX_DIRECTIONS: list[Hex] = [
    Hex(1, 0),   # 0 — E
    Hex(1, -1),  # 1 — NE
    Hex(0, -1),  # 2 — NW
    Hex(-1, 0),  # 3 — W
    Hex(-1, 1),  # 4 — SW
    Hex(0, 1),   # 5 — SE
]


def hex_neighbor(h: Hex, direction: int) -> Hex:
    """Return the neighbor of `h` in direction 0-5 (wraps mod 6)."""
    return h + HEX_DIRECTIONS[direction % 6]


def hex_distance(a: Hex, b: Hex) -> int:
    """Axial cube-distance between two hexes."""
    d = a - b
    return (abs(d.q) + abs(d.q + d.r) + abs(d.r)) // 2


def generate_hex_grid(radius: int) -> set[Hex]:
    """All hexes whose axial distance from the origin is ≤ `radius`."""
    return {
        Hex(q, r)
        for q in range(-radius, radius + 1)
        for r in range(-radius, radius + 1)
        if abs(q + r) <= radius
    }


def axial_to_pixel(q: int, r: int, size: float) -> tuple[float, float]:
    """Flat-top hex: convert axial (q, r) to pixel center (x, y)."""
    x = size * 1.5 * q
    y = size * math.sqrt(3) * (r + q / 2.0)
    return x, y


def flat_hex_corners(cx: float, cy: float, size: float) -> list[tuple[float, float]]:
    """6 corner points for a flat-top hex centered at (cx, cy)."""
    return [
        (cx + size * math.cos(math.radians(60.0 * i)),
         cy + size * math.sin(math.radians(60.0 * i)))
        for i in range(6)
    ]
