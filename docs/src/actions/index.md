# Actions

A bot performs **exactly one** action per turn. Your `Bot.decide` method must return a value from the **`Actions`** helpers below.

## Skip

The skip action tells a splatbot to skip a turn.

```python
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        """ This bot will not do anything. How lazy! """
        return Actions.skip()
```

## Move

The move action tells a splatbot to move in a given direction. The direction given may be either an integer or (recommended) a [HexDirection](../utilities/index.md#hex-direction). A splatbot will move one tile in the given direction, and paint the tile that it lands on. If the movement would result in the splatbot moving to an invalid position, then nothing will happen.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        """ This bot will move in a straight line east across the grid. """
        return Actions.move(HexDirection.E)
```

## Splat

`Actions.splat()` paints every **in-grid neighbor** of your current hex (not the tile you stand on).

After splat:

1. **3 turns** — you cannot **move** or **splat** (`game_state.my_splat_cooldown`). Use `Actions.skip()` if you have no other option.
2. **10 turns** — you cannot **splat** again (`game_state.my_splat_interval`); you may **move** once the 3-turn lockout ends. This enforces at most **one splat every 10 turns**.

```python
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        if game_state.my_splat_cooldown > 0:
            return Actions.skip()
        if game_state.my_splat_interval == 0:
            return Actions.splat()
        return Actions.move(HexDirection.E)
```

See [Writing bots](../writing-bots/) for the full game state reference.

## Shoot paintball

`Actions.shoot_paintball(direction)` does **not** move your bot. It paints every in-grid hex in a straight line in `direction`, starting from the first hex **beyond** your current tile, until the ray leaves the map or reaches a hex occupied by the **other** bot (that hex is **not** painted; the ray stops there).

You cannot use paintball during the splat **move/splat** lockout (`game_state.my_splat_cooldown`). After a shot, default **7 turns** where you **cannot move**, dash, splat, or shoot (`game_state.my_paintball_cooldown`). Separately, by default you can shoot again only after **20** turns (`game_state.my_paintball_interval`). Both are configurable in **SETTINGS** (Paintball lockout / interval).

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.my_splat_cooldown > 0 or game_state.my_paintball_cooldown > 0:
            return Actions.skip()
        if game_state.my_paintball_interval == 0:
            return Actions.shoot_paintball(HexDirection.E)
        return Actions.move(HexDirection.E)
```

## Dash

`Actions.dash(direction, distance)` moves a bot **2–6** hexes in the given `direction` and paints **only the destination** hex.

A bot can dash once every **7 turns**; check `game_state.my_dash_interval` (`0` = dash available).

If the full distance would leave the grid, you stop at the **last in-grid hex** along that direction (the edge), paint only that hex, and the dash cooldown still applies.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.my_splat_cooldown > 0:
            return Actions.skip()
        if game_state.my_dash_interval == 0:
            return Actions.dash(HexDirection.E, 4)
        return Actions.move(HexDirection.E)
```
