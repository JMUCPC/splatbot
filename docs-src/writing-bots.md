# Writing bots

Bots are written as Python scripts that define a `class Bot` with a `decide(self, game_state) -> Action` method that returns an `Action` object. The `Action` object is used to define what actions the bot will take on its turn. The `game_state` object is used to get information about the current state of the game, and to make decisions about what actions to take.

## Template

```python
from utils.actions import Actions # Used for defining actions
from utils.hex_grid import HexDirection # Useful utility functions for working with a hexagonal grid


class Bot:
    def decide(self, game_state) -> Action:
        return # some kind of action, e.g. Actions.move(HexDirection.E)
```

## Actions

Actions are used to define what a bot will do on its turn. An actions is chosen by the return value of the `decide` method (for example, if `decide` returns `Actions.move(HexDirection.E)`, the bot will move east). Special moves come with a cooldown - see [Actions](./actions/index.md) for more details.

| Action                                                | Description                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [move](./actions/index.md#move)                       | Step to an adjacent hex (and paint it).                                              |
| [skip](./actions/index.md#skip)                       | Do nothing this turn.                                                                |
| [splat](./actions/index.md#splat)                     | Paint all neighbors of your current tile.                                            |
| [dash](./actions/index.md#dash)                       | Move multiple tiles in a given direction, and paint only the tile you end up on.     |
| [shoot_paintball](./actions/index.md#shoot_paintball) | Shoot a paintball in a given direction, which will paint every tile it comes across. |

## Game state

The `game_state` object is passed to the `decide` method, and is used to get information about the current state of the game, and to make decisions about what actions to take. It is read-only - bots can only interact with the game based on their returned action.

Useful fields on `game_state`:

| Field                   | Meaning                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `my_pid`                | This bot’s player id as an integer                                                                          |
| `my_stun`               | Turns until actions are allowed (`0` = not stunned). `Actions.skip()` is still valid while stunned.         |
| `my_splat_cooldown`     | Turns until the splat action is allowed again (`0` = splat available)                                       |
| `my_dash_cooldown`      | Turns until the dash action is allowed again (`0` = dash available)                                         |
| `my_paintball_cooldown` | Turns until the shoot_paintball action is allowed again (`0` = paintball available)                         |
| `grid`                  | A set of all tiles in the map.                                                                              |
| `tile_pids`             | `dict` mapping tile → owner (`0` = unpainted)                                                               |
| `bots`                  | `dict` of `BotInfo` (`position`, `facing`, `stun`, `splat_cooldown`, `dash_cooldown`, `paintball_cooldown`) |
| `turn`                  | Current turn                                                                                                |
| `max_turns`             | Number of turns in match                                                                                    |

## Persistence

`Bot` is constructed once when your script loads. Use `self` on the instance to remember anything you need between turns. For example, this bot will remember the direction it last moved in:

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    def __init__(self):
        self._going_east = True

    def decide(self, game_state):
        """ Go east until an edge is hit, then go west until an edge is hit again, then repeat.
        AKA the infamous 'ping-pong' strategy. """
        me = game_state.bots[game_state.my_pid]
        d = HexDirection.E if self._going_east else HexDirection.W
        nbr = hex_neighbor(me.position, d)
        if nbr not in game_state.grid:
            self._going_east = not self._going_east
            d = HexDirection.E if self._going_east else HexDirection.W
        return Actions.move(d)
```
