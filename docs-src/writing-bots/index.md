# Writing Bots

_This tutorial assumes that the reader is familiar with basic scripting (if/for/functions) in Python. No other prerequisite knowledge is required._

## Simple Template

A _bot_ is a Python script run inside the Splatbot game. The game will run it to decide what action should be taken. Here is a simple template of a bot:

```python title="Splatbot Template"
from utils.actions import Actions  # Use this to create the Action that the decide method returns
from utils.hex_grid import Hex, HexDirection, HexUtils  # Hex grid types; use HexUtils(game_state) for helpers

class Bot:
    def decide(self, game_state) -> Action:
        """ This function will use the values provided in `game_state` to return what action it believes it should take."""
        return Actions.skip()  # Template, so do nothing.
```

This may look complicated, but each part of this template is explained in more detail below. _[Actions](../actions/index.md)_ are explained in even greater detail on their own page.

## Imports

Three custom imports are provided to players wanting to create their own splatbot: `utils.actions`, `utils.hex_grid`, and `utils.splatbot_data_types`. `utils.actions` contains the `Actions` class, which provides a template for the [actions](../actions/index.md) a bot may take. `utils.hex_grid` provides assorted grid utilities (`Hex`, `HexDirection`, `HexVector`, and `HexUtils`). `utils.splatbot_data_types` provides optional typing templates (`BotInfo` and `GameState`) for editor hints and static checking. Details are in the [API Docs](../api-docs/): see [_utils.actions_](../api-docs/utils/actions.md), [_utils.hex_grid_](../api-docs/utils/hex_grid.md), and [_utils.splatbot_data_types_](../api-docs/utils/splatbot_data_types.md).

## Deciding on an Action

Each call to `decide` must return **one** of:

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

| Field                                                                      | Meaning                                                                                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [game_state.me](./index.md#bot-info)                                       | Your [BotInfo](./index.md#bot-info) — position, facing, stun, cooldowns.                                                   |
| [game_state.opponents](../api-docs/utils/splatbot_data_types.md#gamestate) | Other players' [BotInfo](./index.md#bot-info), keyed by player id. (Irrelevant in 1v1)                                     |
| [game_state.opponent](../api-docs/utils/splatbot_data_types.md#gamestate)  | The single opponent's [BotInfo](./index.md#bot-info) in 1v1, or None in other modes.                                       |
| [game_state.grid](../hex-grid/index.md)                                    | All hexes on the map ([Hex](../hex-grid/index.md) values). Each has a controller ([BotInfo](./index.md#bot-info) or None). |
| [game_state.turn](../api-docs/utils/splatbot_data_types.md#gamestate)      | Current turn index.                                                                                                        |
| [game_state.max_turns](../api-docs/utils/splatbot_data_types.md#gamestate) | Match length.                                                                                                              |

### Bot Info

`BotInfo` is a class meant to encapsulate all of the data pertaining to some bot. It can be found anywhere a bot is referenced, such as in the `GameState` class.

The fields of BotInfo are:

| Field                                                                  | Type                                                | Meaning                                                                                                     |
| ---------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [pid](../api-docs/utils/splatbot_data_types.md#botinfo)                | int                                                 | Player id (usually 1 or 2).                                                                                 |
| [position](../api-docs/utils/splatbot_data_types.md#botinfo)           | [Hex](../hex-grid/index.md)                         | The bot's current hex (q, r — see [axial coordinates](../hex-grid/index.md#axial)).                         |
| [facing](../api-docs/utils/splatbot_data_types.md#botinfo)             | [HexDirection](../hex-grid/index.md#hex-directions) | Which way the bot is facing (E/NE/NW/W/SW/SE).                                                              |
| [stun](../api-docs/utils/splatbot_data_types.md#botinfo)               | int                                                 | Turns remaining where non-skip actions are blocked ([skip](../actions/index.md#skip)).                      |
| [splat_cooldown](../api-docs/utils/splatbot_data_types.md#botinfo)     | int                                                 | Turns until the bot can [splat](../actions/index.md#splat) again (0 means available).                       |
| [dash_cooldown](../api-docs/utils/splatbot_data_types.md#botinfo)      | int                                                 | Turns until the bot can [dash](../actions/index.md#dash) again (0 means available).                         |
| [paintball_cooldown](../api-docs/utils/splatbot_data_types.md#botinfo) | int                                                 | Turns until the bot can [shoot a paintball](../actions/index.md#shoot-paintball) again (0 means available). |

_Note: There are also `Hex` classes, explained [here](../hex-grid/index.md)_

## Tiebreaking/ Advanced Game Ordering

On every tick, the game calls `decide` on **all** bots simultaneously — each bot sees the exact same game state from the end of the previous tick. After every bot has chosen, all actions are resolved together: positions, paint, and cooldowns update at the same time.

When two actions paint the same tile, the claims cancel out and the tile becomes neutral. Paintball line-of-sight checks use the opponent's **destination** hex (where they will end up after their action this tick).

Whenever a bot's position does not change in a tick (it did not [move](../actions/index.md#move) or [dash](../actions/index.md#dash) to a different hex), it will also claim the tile under itself if there are no conflicts with claims.

## Putting It All Together

This bot moves forward until the next step would leave the grid, then turns 180° and repeats—bouncing between opposite edges like a "ping-pong" along whatever axis it started on. That uses **relative** heading (`facing` + `turn_180`) instead of forcing a fixed compass direction, so it behaves the same for player 1 and player 2. It utilizes all of the bot-writing strategies discussed on this page.

```python title="Ping-Pong Bot"
from utils.actions import Actions
from utils.hex_grid import HexUtils

class Bot:
    """Sweep the board in a hexagonal patrol; splat to claim large amounts of tiles."""

    def __init__(self):
        # used to count moves over the edges of the larger ring shape
        self.steps = 0

    def decide(self, game_state):
        me = game_state.me
        hx = HexUtils(game_state)
        # skip if stunned
        if me.stun > 0:
            return Actions.skip()
        # If splat is off cooldown and the bot is in a good position to splat, then do so
        if me.splat_cooldown == 0 and self.should_splat(game_state):
            return Actions.splat()
        # if moving forward would leave the grid, or if finished with this side of the hexagon, then turn
        forward = hx.hex_neighbor(me.position, me.facing)
        if forward not in game_state.grid or self.steps >= 5:
            self.steps = 0
            return Actions.turn_right()
        # move forwards, and count the move
        self.steps += 1
        return Actions.move()

    def should_splat(self, game_state):
        """Utility Method; True if at least 3 neighboring tiles are not under this bot's control"""
        hx = HexUtils(game_state)
        # count the number of neighbors not controlled by this bot
        count = 0
        neighbors = set(hx.in_grid_neighbors(game_state.me.position))
        for tile in neighbors:
            if not tile.is_controlled_by(game_state.me):
                count += 1
        # only splat if at least 3 neighbors aren't controlled by this bot
        return count >= 3
```

- This bot implements the necessary template to be a game-recognized bot
- This bot uses `HexUtils.hex_neighbor` from `utils.hex_grid` with `me.facing` (not an absolute `HexDirection` constant)
- This bot can return different actions depending on what it thinks is a good next move
- This bot looks into data classes like `GameState` and `BotInfo` to see data about the game

More walkthroughs (cooldowns, painting empty tiles) can be found on the [Examples Page](../examples/index.md).
