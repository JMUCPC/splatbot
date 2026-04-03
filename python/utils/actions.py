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
    "SplatAction",
    "DashAction",
    "ShootPaintballAction",
    "Actions",
]


@dataclass(frozen=True)
class MoveAction:
    direction: HexDirection


@dataclass(frozen=True)
class SkipAction:
    pass


@dataclass(frozen=True)
class SplatAction:
    """Paint every in-grid neighbor of the bot's current hex (not the hex you stand on)."""

    pass


@dataclass(frozen=True)
class DashAction:
    """Move 2-6 hexes in a direction, painting only the destination hex."""

    direction: HexDirection
    distance: int


@dataclass(frozen=True)
class ShootPaintballAction:
    """Paint a ray in ``direction`` until the map edge or another bot (you do not move)."""

    direction: HexDirection


Action = MoveAction | SkipAction | SplatAction | DashAction | ShootPaintballAction


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

    @staticmethod
    def splat() -> SplatAction:
        return SplatAction()

    @staticmethod
    def dash(direction: int | HexDirection, distance: int) -> DashAction:
        if isinstance(direction, int):
            direction = HexDirection(direction % 6)
        return DashAction(direction, int(distance))

    @staticmethod
    def shoot_paintball(direction: int | HexDirection) -> ShootPaintballAction:
        if isinstance(direction, int):
            direction = HexDirection(direction % 6)
        return ShootPaintballAction(direction)
