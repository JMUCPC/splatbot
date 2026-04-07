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
- `Actions`

## Types

### `MoveAction`

```python
@dataclass(frozen=True)
class MoveAction:
    direction: HexDirection
```

Represents a 1-hex move in a direction.

**Fields**
- `direction: HexDirection` - The move direction on the hex grid.

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
    """Move 2-6 hexes in a direction, painting only the destination hex."""
    direction: HexDirection
    distance: int
```

Represents a dash movement action.

**Fields**
- `direction: HexDirection` - Dash direction on the hex grid.
- `distance: int` - Number of hexes to dash.

---

### `ShootPaintballAction`

```python
@dataclass(frozen=True)
class ShootPaintballAction:
    """Paint a ray in ``direction`` until the map edge or another bot (you do not move)."""
    direction: HexDirection
```

Represents a ranged paint action without moving the bot.

**Fields**
- `direction: HexDirection` - Direction of the paintball ray.

---

### `Action`

```python
Action = MoveAction | SkipAction | SplatAction | DashAction | ShootPaintballAction
```

Union type for all legal bot actions.

## Factory API: `Actions`

```python
class Actions:
    """Factories for :class:`Action` values (use from bot scripts / ``Bot.decide``)."""
```

Static helpers to construct valid action objects.

### `Actions.move(direction: int | HexDirection) -> MoveAction`

Create a `MoveAction`.

- If `direction` is an `int`, it is normalized with `direction % 6` and converted
  to `HexDirection`.
- If `direction` is already `HexDirection`, it is used directly.

### `Actions.skip() -> SkipAction`

Create a `SkipAction`.

### `Actions.splat() -> SplatAction`

Create a `SplatAction`.

### `Actions.dash(direction: int | HexDirection, distance: int) -> DashAction`

Create a `DashAction`.

- If `direction` is an `int`, it is normalized with `direction % 6` and converted
  to `HexDirection`.
- `distance` is cast via `int(distance)` before constructing the action.

### `Actions.shoot_paintball(direction: int | HexDirection) -> ShootPaintballAction`

Create a `ShootPaintballAction`.

- If `direction` is an `int`, it is normalized with `direction % 6` and converted
  to `HexDirection`.
- If `direction` is already `HexDirection`, it is used directly.