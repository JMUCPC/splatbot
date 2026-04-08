"""utils/hex_grid.py — Axial-coordinate hex grid utilities.

Uses pointy-top hexagon orientation; axial E/W align with screen right/left (+x / −x).
Reference: https://www.redblobgames.com/grids/hexagons/
"""
from __future__ import annotations
from enum import IntEnum
import math


class Hex:
    """Axial (q, r) hex coordinate with optional tile-ownership controller.

    Equality and hashing use *only* ``(q, r)`` so geometric lookups
    (``hex_neighbor(...) in grid``) work regardless of controller state.
    ``controller`` is ``BotInfo | None`` in the sandbox snapshot.
    """

    __slots__ = ("q", "r", "controller")

    def __init__(self, q: int, r: int, controller: object | None = None) -> None:
        object.__setattr__(self, "q", q)
        object.__setattr__(self, "r", r)
        object.__setattr__(self, "controller", controller)

    def __setattr__(self, *a):
        raise AttributeError("Hex is immutable")

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Hex):
            return NotImplemented
        return self.q == other.q and self.r == other.r

    def __hash__(self) -> int:
        return hash((self.q, self.r))

    def __add__(self, other: Hex | HexVector) -> Hex:
        return Hex(self.q + other.q, self.r + other.r)

    def __radd__(self, other: Hex | HexVector) -> Hex:
        return self.__add__(other)

    def __sub__(self, other: Hex | HexVector) -> Hex:
        return Hex(self.q - other.q, self.r - other.r)

    def __rsub__(self, other: Hex | HexVector) -> Hex:
        return self.__sub__(other)

    def __repr__(self) -> str:
        return f"Hex({self.q}, {self.r})"

    def is_controlled_by(self, bot_or_pid: object) -> bool:
        """Return True when this tile is controlled by *bot_or_pid*.

        Accepts a ``BotInfo`` instance (uses ``==``) or an ``int`` player-id
        (compared to ``self.controller.pid``).
        """
        if self.controller is None:
            return False
        if isinstance(bot_or_pid, int):
            return self.controller.pid == bot_or_pid
        return self.controller == bot_or_pid

class HexVector:
    """Immutable axial vector offset (dq, dr)."""

    __slots__ = ("q", "r")

    def __init__(self, q: int, r: int) -> None:
        object.__setattr__(self, "q", q)
        object.__setattr__(self, "r", r)

    def __setattr__(self, *a):
        raise AttributeError("HexVector is immutable")

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, HexVector):
            return NotImplemented
        return self.q == other.q and self.r == other.r

    def __hash__(self) -> int:
        return hash((self.q, self.r))

    def __add__(self, other: HexVector) -> HexVector:
        return HexVector(self.q + other.q, self.r + other.r)

    def __sub__(self, other: HexVector) -> HexVector:
        return HexVector(self.q - other.q, self.r - other.r)

    def __mul__(self, scalar: int) -> HexVector:
        return HexVector(self.q * scalar, self.r * scalar)

    def __rmul__(self, scalar: int) -> HexVector:
        return self.__mul__(scalar)

    def __repr__(self) -> str:
        return f"HexVector({self.q}, {self.r})"

    @classmethod
    def from_direction_and_distance(
        cls, direction: int | HexDirection, distance: int
    ) -> HexVector:
        step = HEX_DIRECTIONS[int(direction) % 6]
        return cls(step.q * distance, step.r * distance)

class HexDirection(IntEnum):
    """Axial neighbor directions; 0 = +q (E). Screen: E → right, W → left."""

    E = 0
    NE = 1
    NW = 2
    W = 3
    SW = 4
    SE = 5


# Axial step per :class:`HexDirection` value
HEX_DIRECTIONS: list[HexVector] = [
    HexVector(1, 0),   # 0 — E
    HexVector(1, -1),  # 1 — NE
    HexVector(0, -1),  # 2 — NW
    HexVector(-1, 0),  # 3 — W
    HexVector(-1, 1),  # 4 — SW
    HexVector(0, 1),   # 5 — SE
]


def hex_neighbors(h: Hex) -> list[Hex]:
    return [hex_neighbor(h, d) for d in HexDirection]


def hex_neighbor(h: Hex, direction: int | HexDirection) -> Hex:
    """Return the neighbor of `h` in direction 0–5 (wraps mod 6)."""
    return h + HEX_DIRECTIONS[int(direction) % 6]


def hex_distance(a: Hex, b: Hex) -> int:
    """Axial cube-distance between two hexes."""
    d = a - b
    return (abs(d.q) + abs(d.q + d.r) + abs(d.r)) // 2


# def generate_hex_grid(radius: int) -> set[Hex]:
#     """All hexes whose axial distance from the origin is ≤ `radius`."""
#     return {
#         Hex(q, r)
#         for q in range(-radius, radius + 1)
#         for r in range(-radius, radius + 1)
#         if abs(q + r) <= radius
#     }


# def axial_to_pixel(q: int, r: int, size: float) -> tuple[float, float]:
#     """Pointy-top hex: axial (q, r) → pixel center (E increases x, W decreases x)."""
#     x = size * math.sqrt(3.0) * (q + r / 2.0)
#     y = size * 1.5 * r
#     return x, y


# def hex_corners(cx: float, cy: float, size: float) -> list[tuple[float, float]]:
#     """Six corner points for a pointy-top hex (size = center to vertex)."""
#     return [
#         (
#             cx + size * math.cos(math.radians(60.0 * i - 90.0)),
#             cy + size * math.sin(math.radians(60.0 * i - 90.0)),
#         )
#         for i in range(6)
# ]
