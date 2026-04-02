"""utils/actions.py — Bot action datatypes and factory API.

:class:`Bot` in the user script should define ``decide(self, game_state)``
returning a single :class:`Action`. Use :class:`Actions` static methods to
construct actions in bot code.
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
    """Factories for :class:`Action` values (use from bot scripts / ``Bot.decide``)."""

    @staticmethod
    def move(direction: int | HexDirection) -> MoveAction:
        if isinstance(direction, int):
            return MoveAction(HexDirection(direction % 6))
        return MoveAction(direction)

    @staticmethod
    def skip() -> SkipAction:
        return SkipAction()
