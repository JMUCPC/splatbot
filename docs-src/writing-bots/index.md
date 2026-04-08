# Writing bots

_This tutorial assumes that you are familiar with basic scripting (if/for/functions) in Python. No other prerequisite knowledge is required._

A _bot_ is a Python script you copy into Splatbot. The game will use it to decide what action a bot should take. Here is a simple template of a bot:

```python title="Splatbot Template"
from utils.actions import Actions # Use this to create the Action that the decide method returns
from utils.hex_grid import * # This contains helpful functions for working with a hexagonal grid

class Bot:
    def decide(self, game_state) -> Action:
        """ This function will use the values provided in `game_state` to return what action it believes it should take."""
        return Actions.skip() # Template, so do nothing.
```

This may look complicated, but each part of this template is explained in more detail below. _[Actions](../actions/index.md)_ are explained in greater detail on their own page.

## Imports

Two custom imports are provided to players wanting to create their own splatbot: `utils.actions` and `utils.hex_grid`. The first contains the `Actions` class, which provides a template for the actions a bot may take. A detailed breakdown of how this works is provided [here](../actions/index.md). The second import provides useful utilities for working with a hexagonal grid. A similarly detailed breakdown for this can be found [here](../hex-grid/).

## Deciding on an Action

On every tick, the game will call the `decide` method of each bot in the game. Each call to `decide` must return **one** of:

| Action                                                                                       | Description                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [move](../actions/index.md#move)                                                             | Step one hex **forward** and paint that hex.           |
| [turn_left / turn_right / face_direction / turn_180](../actions/index.md#facing-and-turning) | Change facing only (one tick each).                    |
| [skip](../actions/index.md#skip)                                                             | Do nothing.                                            |
| [splat](../actions/index.md#splat)                                                           | Paint all adjacent tiles.                              |
| [dash](../actions/index.md#dash)                                                             | Move 2–6 hexes **forward**; paint only where you land. |
| [shoot_paintball](../actions/index.md#shoot-paintball)                                       | Paint a straight line **forward** without moving.      |

Details and interactive demos are on the [Actions](../actions/index.md) page.

If the returned action is invalid for any reason, or if the `decide` method raises an Error/Exception or exceeds the time limit (configurable via settings), then the bot's move will be skipped for the current turn.

### Simple Example

This bot aligns to **east**, then **moves forward** on later ticks (see [facing](../actions/index.md#facing-and-turning)).

```python title="Forward Bot"
from utils.actions import Actions
from utils.hex_grid import *


class Bot:
    def decide(self, game_state):
        """ Always choose to walk forwards. """
        return Actions.move()
```

## Remembering Data

The game creates a singular instance of `Bot` when your script loads. If you need to remember a value between calls to the `decide` method (for example "which way was I going last tick?"), it can be stored as an instance variable on `self`.

To set starting values of these instance variables, add a constructor to the `Bot` class: `def __init__(self):`. This is optional, and only necessary if you wish to make a bot that can remember things. However, advanced bot strategies may benefit by using memory in their decisions.

### Example

```python title="Counting Bot"
from utils.actions import Actions
from utils.hex_grid import *

class Bot:
    def __init__(self):
        self.count = 0

    def decide(self, game_state):
        self.count += 1
        print(self.count)  # print goes to the browser console: open with F12
        return Actions.skip()
```

## Data Classes

### Game State

`game_state` is **read-only**. You interact with the match only by **returning** an action.

| Field       | Meaning                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| `pid`       | Your player id (`1` or `2`).                                                        |
| `me`        | Your BotInfo — `position`, `facing`, `stun`, cooldowns.                             |
| `opponents` | Other players' BotInfo, keyed by player id.                                         |
| `opponent`  | The single opponent's BotInfo in 1v1, or `None`.                                    |
| `grid`      | All hexes on the map (`Hex` values). Each has a `controller` (`BotInfo` or `None`). |
| `turn`      | Current turn index.                                                                 |
| `max_turns` | Match length.                                                                       |

### BotInfo

TODO: table of actual contents of BotInfo

...

`BotInfo` is found in many of the fields of `GameState`.

| Expression                  | What it gives you                                 |
| --------------------------- | ------------------------------------------------- |
| `game_state.me`             | Your bot's `BotInfo`.                             |
| `game_state.opponent`       | The single opponent in 1v1 (`None` otherwise).    |
| `game_state.opponents[pid]` | A specific opponent by player id.                 |
| `hex.controller`            | The `BotInfo` that controls this tile, or `None`. |

## Putting it all together

This bot moves east until the next east step would leave the grid, then flips and moves west until it hits the other edge, and repeats — making a "ping-pong" pattern.

```python title="Ping-Pong Bot"
from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    def __init__(self):
        self.going_east = True

    def decide(self, game_state):
        me = game_state.me
        d = HexDirection.E if self.going_east else HexDirection.W
        nbr = hex_neighbor(me.position, d)
        if nbr not in game_state.grid:
            self.going_east = not self.going_east
            d = HexDirection.E if self.going_east else HexDirection.W
        if me.facing != d:
            return Actions.face_direction(d)
        return Actions.move()
```

- `game_state.me` is your bot's info (`position`, `facing`, cooldowns, etc.).
- `hex_neighbor(hex, direction)` is the hex you would step into; if it is not in `game_state.grid`, that move would leave the map, so we flip direction first.
- We **face** the desired travel direction, then **move** forward on the next tick when already aligned.

More walkthroughs (cooldowns, painting empty tiles) are on [Examples](../examples/index.md).
