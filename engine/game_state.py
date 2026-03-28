"""engine/game_state.py — Authoritative game state.

GameState is treated as an immutable snapshot: a new instance is
produced each turn rather than mutating the existing one.  This keeps
the frontend and engine decoupled (the frontend always holds a safe
read-only copy).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum

from engine.hex_grid import Hex, generate_hex_grid
import config


class Owner(Enum):
    NONE = 0
    PLAYER_1 = 1
    PLAYER_2 = 2


@dataclass
class GameState:
    # Core grid data
    grid: set[Hex]
    tile_owners: dict[Hex, Owner]  # hex → who painted it (NONE if unpainted)
    bot_positions: dict[int, Hex]  # player_id (1 or 2) → current hex

    # Match metadata
    turn: int = 0
    max_turns: int = 200
    radius: int = 8

    # Per-player ability cooldowns and use counts (extensible)
    # key: (player_id, ability_name) → turns remaining on cooldown
    cooldowns: dict[tuple, int] = field(default_factory=dict)
    # key: (player_id, ability_name) → total activations this match
    ability_uses: dict[tuple, int] = field(default_factory=dict)

    # ── Derived properties ────────────────────────────────────────────────

    @property
    def is_over(self) -> bool:
        return self.turn >= self.max_turns

    def score(self) -> dict[int, int]:
        """Return {player_id: tile_count} for both players."""
        return {
            1: sum(1 for o in self.tile_owners.values() if o == Owner.PLAYER_1),
            2: sum(1 for o in self.tile_owners.values() if o == Owner.PLAYER_2),
        }

    def total_tiles(self) -> int:
        return len(self.grid)

    def coverage_pct(self) -> dict[int, float]:
        """Percentage of total tiles painted by each player."""
        sc = self.score()
        total = max(1, self.total_tiles())
        return {pid: 100.0 * count / total for pid, count in sc.items()}

    def winner(self) -> int | None:
        """Return winning player_id, or None if match isn't over / tied."""
        if not self.is_over:
            return None
        sc = self.score()
        if sc[1] > sc[2]:
            return 1
        if sc[2] > sc[1]:
            return 2
        return None  # draw


# ── Factory ───────────────────────────────────────────────────────────────────


def make_initial_state(radius: int = 8, max_turns: int = 200) -> GameState:
    """Create a fresh game state with bots placed on opposite sides."""
    grid = generate_hex_grid(radius)

    # Starting positions: left and right extremes of the middle row
    pos1 = config.START_POS_1
    pos2 = config.START_POS_2

    tile_owners: dict[Hex, Owner] = {
        pos1: Owner.PLAYER_1,
        pos2: Owner.PLAYER_2,
    }

    return GameState(
        grid=grid,
        tile_owners=tile_owners,
        bot_positions={1: pos1, 2: pos2},
        turn=0,
        max_turns=max_turns,
        radius=radius,
    )
