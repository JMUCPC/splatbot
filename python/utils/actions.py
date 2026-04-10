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
    "TurnLeftAction",
    "TurnRightAction",
    "FaceDirectionAction",
    "Turn180Action",
    "Actions",
]


@dataclass(frozen=True)
class MoveAction:
    pass


@dataclass(frozen=True)
class SkipAction:
    pass


@dataclass(frozen=True)
class SplatAction:
    """Paint every in-grid neighbor of the bot's current hex (not the hex you stand on)."""

    pass


@dataclass(frozen=True)
class DashAction:
    """Move ``distance`` hexes (2–6) straight ahead (current facing), painting only the destination hex."""

    distance: int


@dataclass(frozen=True)
class ShootPaintballAction:
    """Paint a ray straight ahead until the map edge or another bot (you do not move)."""

    pass


@dataclass(frozen=True)
class TurnLeftAction:
    """Increase direction index by ``steps`` (mod 6); e.g. E → NE when steps==1 (pivots left on default view)."""

    steps: int = 1


@dataclass(frozen=True)
class TurnRightAction:
    """Decrease direction index by ``steps`` (mod 6); e.g. E → SE when steps==1 (pivots right on default view)."""

    steps: int = 1


@dataclass(frozen=True)
class FaceDirectionAction:
    direction: HexDirection


@dataclass(frozen=True)
class Turn180Action:
    pass


Action = (
    MoveAction
    | SkipAction
    | SplatAction
    | DashAction
    | ShootPaintballAction
    | TurnLeftAction
    | TurnRightAction
    | FaceDirectionAction
    | Turn180Action
)


class Actions:
    """Factories for :class:`Action` values.

    Bot scripts should return one of these values from ``Bot.decide``.
    """

    @staticmethod
    def move() -> MoveAction:
        return MoveAction()

    @staticmethod
    def skip() -> SkipAction:
        return SkipAction()

    @staticmethod
    def splat() -> SplatAction:
        return SplatAction()

    @staticmethod
    def dash(distance: int) -> DashAction:
        return DashAction(int(distance))

    @staticmethod
    def shoot_paintball() -> ShootPaintballAction:
        return ShootPaintballAction()

    @staticmethod
    def turn_left(steps: int = 1) -> TurnLeftAction:
        return TurnLeftAction(int(steps))

    @staticmethod
    def turn_right(steps: int = 1) -> TurnRightAction:
        return TurnRightAction(int(steps))

    @staticmethod
    def face_direction(direction: int | HexDirection) -> FaceDirectionAction:
        if isinstance(direction, int):
            direction = HexDirection(direction % 6)
        return FaceDirectionAction(direction)

    @staticmethod
    def turn_180() -> Turn180Action:
        return Turn180Action()
