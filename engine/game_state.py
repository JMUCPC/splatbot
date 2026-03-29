"""engine/game_state.py — Authoritative game state.

Each :class:`GameState` value is an immutable snapshot: a new instance is
produced each turn rather than mutating the existing one. The process-wide
:class:`GameStateSingleton` holds a reference to the current snapshot for
code that shares one match (e.g. the GUI).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import ClassVar

from bots.error import ErrorBot
from bots.random import RandomBot
from bots.straight_line import StraightLineBot
from engine.abstract_bot import AbstractBot
from engine.actions import Action, MoveAction, SkipAction
from engine.hex_grid import Hex, HexDirection, generate_hex_grid, hex_neighbor
import config


@dataclass
class BotData:
    pid: int
    bot: AbstractBot
    position: Hex
    facing: HexDirection


@dataclass
class GameState:
    # Core grid data
    grid: set[Hex]
    # hex → player_id that painted it (0 = unpainted)
    tile_pids: dict[Hex, int]
    bots: dict[int, BotData]  # player_id (1 or 2) → bot data

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
            1: sum(1 for pid in self.tile_pids.values() if pid == 1),
            2: sum(1 for pid in self.tile_pids.values() if pid == 2),
        }

    def advance_turn(self) -> None:
        self.turn += 1

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

    def apply_action(self, pid: int, action: Action) -> None:
        bot = self.bots[pid]
        match action:
            case MoveAction(direction):
                new_pos = hex_neighbor(bot.position, direction)
                if new_pos in self.grid:
                    bot.position = new_pos
                    bot.facing = direction
                    self.tile_pids[new_pos] = pid
            case SkipAction():
                pass


# ── Factory ───────────────────────────────────────────────────────────────────


def make_initial_state(
    radius: int = config.GRID_RADIUS, max_turns: int = config.MAX_TURNS
) -> GameState:
    """Create a fresh game state with bots placed on opposite sides."""
    grid = generate_hex_grid(radius)

    # Starting positions: left and right extremes of the middle row
    pos1 = config.START_POS_1
    pos2 = config.START_POS_2

    tile_pids: dict[Hex, int] = {
        pos1: 1,
        pos2: 2,
    }

    bots: dict[int, BotData] = {
        1: BotData(
            pid=1,
            bot=StraightLineBot(),
            position=pos1,
            facing=HexDirection.E,
        ),
        2: BotData(
            pid=2,
            bot=ErrorBot(),
            position=pos2,
            facing=HexDirection.W,
        ),
    }

    return GameState(
        grid=grid,
        tile_pids=tile_pids,
        bots=bots,
        turn=0,
        max_turns=max_turns,
        radius=radius,
    )


class GameStateSingleton:
    """Single holder for the active match’s current :class:`GameState` snapshot."""

    _instance: ClassVar[GameStateSingleton | None] = None
    _state: GameState

    def __new__(cls) -> GameStateSingleton:
        if cls._instance is None:
            inst = super().__new__(cls)
            inst._state = make_initial_state(config.GRID_RADIUS, config.MAX_TURNS)
            cls._instance = inst
        return cls._instance

    @property
    def current(self) -> GameState:
        return self._state

    def replace(self, state: GameState) -> None:
        """Point the singleton at a new snapshot (typically the next turn)."""
        self._state = state

    def reset(
        self,
        radius: int | None = None,
        max_turns: int | None = None,
    ) -> None:
        """Replace the match with a fresh initial state."""
        r = config.GRID_RADIUS if radius is None else radius
        t = config.MAX_TURNS if max_turns is None else max_turns
        self._state = make_initial_state(r, t)
