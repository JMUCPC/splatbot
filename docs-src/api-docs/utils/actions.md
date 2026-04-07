# `utils.actions` API Reference

Bot scripts should return a single `Action` from `Bot.decide(self, game_state)`.
This module defines immutable action datatypes and a factory class (`Actions`)
used to construct them.

## Exports

- `Action`
- `MoveAction`
- `SkipAction`
- `SplatAction`
- `DashAction`
- `ShootPaintballAction`
- `TurnLeftAction`
- `TurnRightAction`
- `FaceDirectionAction`
- `Turn180Action`
- `Actions`

## Types

### `MoveAction`

```python
@dataclass(frozen=True)
class MoveAction:
    pass
```

One hex forward in the bot’s current **facing**; paints the landing tile.

**Fields**

- None (direction comes from game state).

---

### `SkipAction`

```python
@dataclass(frozen=True)
class SkipAction:
    pass
```

Represents taking no action for the turn.

**Fields**

- None

---

### `SplatAction`

```python
@dataclass(frozen=True)
class SplatAction:
    """Paint every in-grid neighbor of the bot's current hex (not the hex you stand on)."""
```

Paints every in-bounds neighboring hex around the bot's current position.
Does **not** paint the bot's own hex.

**Fields**

- None

---

### `DashAction`

```python
@dataclass(frozen=True)
class DashAction:
    """Move ``distance`` hexes straight ahead (facing); paint only the destination hex."""
    distance: int
```

**Fields**

- `distance: int` — Number of hexes to dash (engine expects **2–6**).

---

### `ShootPaintballAction`

```python
@dataclass(frozen=True)
class ShootPaintballAction:
    """Paint a ray straight ahead until the map edge or another bot (you do not move)."""
    pass
```

**Fields**

- None (ray uses current **facing**).

---

### `TurnLeftAction`

```python
@dataclass(frozen=True)
class TurnLeftAction:
    steps: int = 1
```

Add `steps` to the direction index (mod 6), one tick — e.g. **E → NE** when `steps == 1` (pivots **left** on the default map view).

---

### `TurnRightAction`

```python
@dataclass(frozen=True)
class TurnRightAction:
    steps: int = 1
```

Subtract `steps` from the direction index (mod 6), one tick — e.g. **E → SE** when `steps == 1` (pivots **right** on the default map view).

---

### `FaceDirectionAction`

```python
@dataclass(frozen=True)
class FaceDirectionAction:
    direction: HexDirection
```

Set **facing** to an absolute direction, one tick.

---

### `Turn180Action`

```python
@dataclass(frozen=True)
class Turn180Action:
    pass
```

Turn **facing** 180° (opposite direction), one tick.

---

### `Action`

```python
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
```

Union type for all legal bot actions.

## Factory API: `Actions`

```python
class Actions:
    """Factories for :class:`Action` values (use from bot scripts / ``Bot.decide``)."""
```

Static helpers to construct valid action objects.

### `Actions.move() -> MoveAction`

Step one hex forward (current facing).

### `Actions.skip() -> SkipAction`

Create a `SkipAction`.

### `Actions.splat() -> SplatAction`

Create a `SplatAction`.

### `Actions.dash(distance: int) -> DashAction`

Dash straight ahead for `int(distance)` hexes (engine validates **2–6**).

### `Actions.shoot_paintball() -> ShootPaintballAction`

Fire a paintball ray along current **facing**.

### `Actions.turn_left(steps: int = 1) -> TurnLeftAction`

### `Actions.turn_right(steps: int = 1) -> TurnRightAction`

### `Actions.face_direction(direction: int | HexDirection) -> FaceDirectionAction`

If `direction` is an `int`, it is normalized with `direction % 6` and converted to `HexDirection`.

### `Actions.turn_180() -> Turn180Action`

Flip **facing** to the opposite direction.
