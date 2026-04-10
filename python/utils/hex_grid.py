"""utils/hex_grid.py — Axial-coordinate hex grid utilities.

Uses pointy-top hexagon orientation; axial E/W align with screen right/left (+x / −x).
Grid helpers live on :class:`HexUtils`, constructed with the current ``game_state``.
Reference: https://www.redblobgames.com/grids/hexagons/
"""
from __future__ import annotations
from enum import IntEnum
from utils.splatbot_data_types import BotInfo, GameState

class Hex:
    """Axial (q, r) hex coordinate with optional tile-ownership controller.

    Equality and hashing use *only* ``(q, r)`` so geometric lookups
    (``HexUtils(game_state).hex_neighbor(...) in grid``) work regardless of controller state.
    ``controller`` is ``BotInfo | None`` in the sandbox snapshot.
    """

    def __init__(self, q: int, r: int, controller: BotInfo | None = None) -> None:
        # Use object.__setattr__ to set the attributes of the class while maintaining immutability
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

    def is_controlled_by(self, bot_or_pid: BotInfo | int) -> bool:
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

    def __init__(self, q: int, r: int) -> None:
        # Use object.__setattr__ to set the attributes of the class while maintaining immutability
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


class HexUtils:
    """Hex grid helpers bound to a turn snapshot (``game_state``).

    The snapshot is the same object passed to ``Bot.decide``; it is stored so
    methods can use board context where needed.
    """

    def __init__(self, game_state: GameState) -> None:
        self.game_state = game_state
        
    def hex_neighbor(self, h: Hex, direction: int | HexDirection) -> Hex:
        """Return the neighbor of `h` in direction 0–5 (wraps mod 6)."""
        direction_index = int(direction) % 6
        step = HEX_DIRECTIONS[direction_index]
        return h + step

    def hex_neighbors(self, h: Hex) -> list[Hex]:
        """Return all six neighbors of ``h`` in enum order (E → SE)."""
        neighbors: list[Hex] = []
        for direction in HexDirection:
            neighbor = self.hex_neighbor(h, direction)
            neighbors.append(neighbor)
        return neighbors

    def in_grid_neighbors(self, h: Hex) -> list[Hex]:
        """Return grid tile objects for neighbors of ``h`` that are on the map.

        Each value is the actual ``Hex`` from ``game_state.grid`` (including
        ``controller``), not a synthetic neighbor from coordinate arithmetic.
        """
        in_grid: list[Hex] = []
        for neighbor in self.hex_neighbors(h):
            tile = self.hex_at(neighbor)
            if tile is not None:
                in_grid.append(tile)
        return in_grid

    def hex_at(self, h: Hex) -> Hex | None:
        """Return the matching grid tile object for position ``h``, if present."""
        for tile in self.game_state.grid:
            if tile == h:
                return tile
        return None

    def hex_controller(self, h: Hex) -> BotInfo | None:
        """Return controller of tile ``h`` from the current grid, or ``None``."""
        tile = self.hex_at(h)
        if tile is None:
            return None
        return tile.controller

    def hex_distance(self, a: Hex, b: Hex) -> int:
        """Axial cube-distance between two hexes."""
        d = a - b
        return (abs(d.q) + abs(d.q + d.r) + abs(d.r)) // 2
