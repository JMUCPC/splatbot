"""Typing-only reference datatypes for Splatbot bot scripts.

These classes are templates for editor hints and static checking. Runtime
objects provided by the sandbox are immutable snapshot objects with equivalent
fields.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType

from utils.hex_grid import Hex, HexDirection

__all__ = ["BotInfo", "GameState"]


@dataclass(frozen=True)
class BotInfo:
    """Template shape of bot metadata exposed on ``game_state``."""

    pid: int
    position: Hex
    facing: HexDirection
    stun: int = 0
    splat_cooldown: int = 0
    dash_cooldown: int = 0
    paintball_cooldown: int = 0


@dataclass(frozen=True)
class GameState:
    """Template shape of the read-only snapshot passed into ``Bot.decide``."""

    me: BotInfo
    opponents: MappingProxyType[int, BotInfo]
    opponent: BotInfo | None
    grid: frozenset[Hex]
    turn: int
    max_turns: int

    def get_grid_as_2D_list(self) -> list[list[Hex]]:
        """Return a row-major view of ``grid`` sorted by axial coordinates."""
        # Group tiles by r-coordinate first.
        rows_by_r: dict[int, list[Hex]] = {}
        for tile in self.grid:
            if tile.r not in rows_by_r:
                rows_by_r[tile.r] = []
            rows_by_r[tile.r].append(tile)

        # Sort rows by r, and each row by q.
        ordered_rows: list[list[Hex]] = []
        for r_value in sorted(rows_by_r):
            row = rows_by_r[r_value]
            row_sorted_by_q = sorted(row, key=lambda h: h.q)
            ordered_rows.append(row_sorted_by_q)

        return ordered_rows
