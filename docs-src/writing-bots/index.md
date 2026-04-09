# Writing bots

_This tutorial assumes that the reader is familiar with basic scripting (if/for/functions) in Python. No other prerequisite knowledge is required._

## Simple Template

A _bot_ is a Python script run inside the Splatbot game. The game will run it to decide what action should be taken. Here is a simple template of a bot:

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

Two custom imports are provided to players wanting to create their own splatbot: `utils.actions` and `utils.hex_grid`. The first contains the `Actions` class, which provides a template for the [actions](../actions/index.md) a bot may take. The second import provides useful utilities for working with a [hexagonal grid](../hex-grid/). Details on the functions inside these imports can be found in the [API Docs](../api-docs/): see [_utils.actions_](../api-docs/utils/actions.md) and [_utils.hex_grid_](../api-docs/utils/hex_grid.md).

## Deciding on an Action

On every tick, the game will call the `decide` method of each bot in the game. Each call to `decide` must return **one** of:

| Action                                                 | Description                                          |
| ------------------------------------------------------ | ---------------------------------------------------- |
| [move](../actions/index.md#move)                       | Step one hex forward and paint it.                   |
| [turn_left](../actions/index.md#turn-left)             | Turn left 1-5 steps.                                 |
| [turn_right](../actions/index.md#turn-right)           | Turn right 1-5 steps.                                |
| [turn_180](../actions/index.md#turn-around)            | Turn around.                                         |
| [face_direction](../actions/index.md#face-direction)   | Turn to face a specified direction.                  |
| [skip](../actions/index.md#skip)                       | Do nothing.                                          |
| [splat](../actions/index.md#splat)                     | Paint all neighboring tiles.                         |
| [shoot_paintball](../actions/index.md#shoot-paintball) | Paint a straight line forward without moving.        |
| [dash](../actions/index.md#dash)                       | Move 2–6 hexes forward - paint only the destination. |

Details and interactive demos are on the [Actions](../actions/index.md) page.

If the returned action is invalid for any reason, or if the `decide` method raises an Error/Exception or exceeds the time limit (configurable via settings), then the bot's move will be skipped for the current turn.

### Simple Example

This bot moves forwards.

```python title="Forward Bot"
from utils.actions import Actions
from utils.hex_grid import *


class Bot:
    def decide(self, game_state):
        """ Always choose to walk forwards. """
        return Actions.move()
```

## Remembering Data

The game creates a singular instance of the `Bot` class when a script loads. To remember a value between calls to the `decide` method (for example "which way was this bot going last tick?"), it can be stored as an instance variable on `self`.

To set starting values of these instance variables, add a constructor to the `Bot` class: `def __init__(self):`. This is optional, and only necessary to make a bot that can remember things. However, advanced bot strategies may benefit by using memory in their decisions.

### Example

```python title="Counting Bot"
from utils.actions import Actions
from utils.hex_grid import *

class Bot:
    """ This Bot will count by incrementing a saved instance variable. """
    def __init__(self):
        self.count = 0

    def decide(self, game_state):
        self.count += 1
        print(self.count)  # print goes to the browser console: open with F12
        return Actions.skip()
```

## Data Classes

### Game State

In order to make more informed decisions, a bot needs to be able to see the current state of the game. This information is available as an argument to the `decide` method, aptly named `game_state` in the provided [template](./index.md#simple-template). This `game_state` argument is **read-only**. A bot will only interact with the match only by returning an action.

| Field                  | Meaning                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `game_state.me`        | Your BotInfo — `position`, `facing`, `stun`, cooldowns.                             |
| `game_state.opponents` | Other players' BotInfo, keyed by player id. (Irrelevant in 1v1)                     |
| `game_state.opponent`  | The single opponent's BotInfo in 1v1, or `None` in other modes.                     |
| `game_state.grid`      | All hexes on the map (`Hex` values). Each has a `controller` (`BotInfo` or `None`). |
| `game_state.turn`      | Current turn index.                                                                 |
| `game_state.max_turns` | Match length.                                                                       |

### BotInfo

`BotInfo` is a class meant to encapsulate all of the data pertaining to some bot.

It can be found anywhere a bot is referenced:

| Expression            | What it gives you                                 |
| --------------------- | ------------------------------------------------- |
| `game_state.me`       | Your bot's `BotInfo`.                             |
| `game_state.opponent` | The single opponent in 1v1 (`None` otherwise).    |
| `hex.controller`      | The `BotInfo` that controls this tile, or `None`. |

The fields of BotInfo are:

| Field                | Type           | Meaning                                                                |
| -------------------- | -------------- | ---------------------------------------------------------------------- |
| `pid`                | `int`          | Player id (usually `1` or `2`).                                        |
| `position`           | `Hex`          | The bot's current hex (`q`, `r`).                                      |
| `facing`             | `HexDirection` | Which way the bot is facing (`E/NE/NW/W/SW/SE`).                       |
| `stun`               | `int`          | Turns remaining where non-skip actions are blocked.                    |
| `splat_cooldown`     | `int`          | Turns until the bot can splat again (`0` means available).             |
| `dash_cooldown`      | `int`          | Turns until the bot can dash again (`0` means available).              |
| `paintball_cooldown` | `int`          | Turns until the bot can shoot a paintball again (`0` means available). |

_Note: There are also `Hex` classes, explained [here](../hex-grid/index.md#the-hex-grid)_

## Putting It All Together

This bot moves east until the next east step would leave the grid, when it instead turns around and moves west until it hits the other edge, and repeats - making a "ping-pong" pattern. It utilizes all of the bot-writing strategies discussed on this page.

```python title="Ping-Pong Bot"
from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    """This bot will ping-pong between moving east and west."""

    def __init__(self):
        """Start the match going east. """
        self.going_east = True

    def get_current_direction(self):
        """ Return the HexDirection that the bot is currently moving in."""
        if self.going_east:
            return HexDirection.E
        else:
            return HexDirection.W

    def decide(self, game_state):
        """ Keep going a direction until an edge is found, then turn around."""

        # Find the next position the bot will be in if it continues moving in the same direction
        direction = self.get_current_direction()
        next_position = hex_neighbor(game_state.me.position, direction)

        # If the anticipated position falls outside of the grid, turn around instead
        if next_position not in game_state.grid:
            self.going_east = not self.going_east
            direction = self.get_current_direction()

        # If the bot is not currently facing the desired direction, turn to do so
        if game_state.me.facing != direction:
            return Actions.face_direction(direction)

        # Keep on movin'
        return Actions.move()
```

- This bot implements the necessary template to be a game-recognized bot (and even implements a custom helper method!)
- This bot uses some of the utilities provided in `utils.hex_grid`
- This bot can return different actions depending on what it thinks is a good next move
- This bot looks into data classes like `GameState` and `BotInfo` to see data about the game

More walkthroughs (cooldowns, painting empty tiles) can be found on the [Examples Page](../examples/index.md).
