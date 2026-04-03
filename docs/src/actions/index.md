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
