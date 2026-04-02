"""utils/hex_grid.py — Axial-coordinate hex grid utilities.

Uses pointy-top hexagon orientation; axial E/W align with screen right/left (+x / −x).
Reference: https://www.redblobgames.com/grids/hexagons/
"""
from __future__ import annotations
from dataclasses import dataclass
from enum import IntEnum
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


class HexDirection(IntEnum):
    """Axial neighbor directions; 0 = +q (E). Screen: E → right, W → left."""

    E = 0
    NE = 1
    NW = 2
    W = 3
    SW = 4
    SE = 5


# Axial step per :class:`HexDirection` value
HEX_DIRECTIONS: list[Hex] = [
    Hex(1, 0),   # 0 — E
    Hex(1, -1),  # 1 — NE
    Hex(0, -1),  # 2 — NW
    Hex(-1, 0),  # 3 — W
    Hex(-1, 1),  # 4 — SW
    Hex(0, 1),   # 5 — SE
]


def hex_neighbor(h: Hex, direction: int | HexDirection) -> Hex:
    """Return the neighbor of `h` in direction 0–5 (wraps mod 6)."""
    return h + HEX_DIRECTIONS[int(direction) % 6]


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
    """Pointy-top hex: axial (q, r) → pixel center (E increases x, W decreases x)."""
    x = size * math.sqrt(3.0) * (q + r / 2.0)
    y = size * 1.5 * r
    return x, y


def hex_corners(cx: float, cy: float, size: float) -> list[tuple[float, float]]:
    """Six corner points for a pointy-top hex (size = center to vertex)."""
    return [
        (
            cx + size * math.cos(math.radians(60.0 * i - 90.0)),
            cy + size * math.sin(math.radians(60.0 * i - 90.0)),
        )
        for i in range(6)
    ]
