"""utils/actions.py — Bot action datatypes and factory API.

``decide(game_state)`` should return a single :class:`Action`
instance. Use :class:`Actions` static methods to construct actions in bot code.
"""

from __future__ import annotations

from dataclasses import dataclass

from utils.hex_grid import HexDirection

__all__ = [
    "Action",
    "MoveAction",
    "SkipAction",
    "Actions",
]


@dataclass(frozen=True)
class MoveAction:
    direction: HexDirection


@dataclass(frozen=True)
class SkipAction:
    pass


Action = MoveAction | SkipAction


class Actions:
    """Factories for :class:`Action` values (use from bot scripts / ``decide``)."""

    @staticmethod
    def move(direction: int | HexDirection) -> MoveAction:
        if isinstance(direction, int):
            return MoveAction(HexDirection(direction % 6))
        return MoveAction(direction)

    @staticmethod
    def skip() -> SkipAction:
        return SkipAction()
