# Writing bots

A **bot** is a Python script you paste into Splatbot. The site loads it once, then calls a function you provide **once per [tick](glossary/index.md#tick)** (see [turn vs tick](glossary/index.md#turn) in the [glossary](glossary/index.md)) so your code can choose what to do next.

You do **not** control the game loop directly. Each time, you **read** the current <abbr title="Read-only snapshot: board, positions, timers"><code>game_state</code></abbr> (see [below](#game-state-quick-reference)) and **return** exactly one [action](glossary/index.md#action) — for example “move east” or “skip this turn.”

If you know basic Python (variables, `if`, functions) you can start. The `class Bot` block below is a **pattern to copy**; treat `decide` as “the function that runs every turn.” Optional: learn why `self` appears under [Remembering things between turns](#remembering-things-between-turns).

Stuck? Try [Debugging](debugging/index.md) (`print`, **Step**, event log) and the [glossary](glossary/index.md).

## Smallest working bot

This bot always tries to move **east** one hex (and paint the tile it lands on). Copy it as a starting point.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        # game_state describes the board; we return one action.
        return Actions.move(HexDirection.E)
```

- **`class Bot`:** Required name. The site looks for this class.
- **`decide(self, game_state):`** Required method. `game_state` is a read-only snapshot; see the [table below](#game-state-quick-reference).
- **`return`:** Must be an action from `Actions` (see [Actions](actions/index.md)).

Wrong return type or raising an error usually shows up in the [event log](debugging/index.md#event-log) or console — see [Debugging](debugging/index.md).

## One action per turn

Each call to `decide` must return **one** of:

| Action | Plain English |
| ------ | ------------- |
| [move](actions/index.md#move) | Step to a neighbor hex; paint that hex. |
| [skip](actions/index.md#skip) | Do nothing. |
| [splat](actions/index.md#splat) | Paint neighbors (with [stun](glossary/index.md#stun) / [cooldown](glossary/index.md#cooldown) rules). |
| [dash](actions/index.md#dash) | Move several hexes in a line; paint only where you land. |
| [shoot_paintball](actions/index.md#shoot-paintball) | Paint a straight line without moving. |

Details and interactive demos are on the [Actions](actions/index.md) page.

## Remembering things between turns

The site creates **one** `Bot` instance when your script loads. If you need to remember a value after `decide` returns (for example “which way was I going?”), store it on **`self`**.

You can add `def __init__(self):` to set starting values. This is optional; many bots only need `decide`.

**Tiny example — a turn counter:**

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def __init__(self):
        self._n = 0

    def decide(self, game_state):
        self._n += 1
        # print(self._n)  # see Debugging: print goes to the browser console
        return Actions.move(HexDirection.E)
```

## Example: ping-pong on the map

This bot moves east until the next east step would leave the [grid](glossary/index.md#hex), then flips and moves west until it hits the other edge, and repeats — the “ping-pong” pattern.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    def __init__(self):
        self._going_east = True

    def decide(self, game_state):
        me = game_state.bots[game_state.my_pid]
        d = HexDirection.E if self._going_east else HexDirection.W
        nbr = hex_neighbor(me.position, d)
        if nbr not in game_state.grid:
            self._going_east = not self._going_east
            d = HexDirection.E if self._going_east else HexDirection.W
        return Actions.move(d)
```

- `game_state.bots[game_state.my_pid]` is [your bot’s info](glossary/index.md#botinfo) (`position`, etc.).
- `hex_neighbor(hex, direction)` is the hex you would step into; if it is not in `game_state.grid`, that move would leave the map, so we flip direction first.

More walkthroughs (cooldowns, painting empty tiles) are on [Examples](examples/index.md).

## Game state quick reference

[`game_state`](glossary/index.md#game_state) is **read-only**. You interact with the match only by **returning** an action.

| Field | Meaning |
| ----- | ------- |
| `my_pid` | Your [player id](glossary/index.md#player-id) (`1` or `2`). |
| `my_stun` | Turns until you cannot move/dash/splat/shoot (`0` = not [stunned](glossary/index.md#stun)). `Actions.skip()` still works. |
| `my_splat_cooldown` | Turns until [splat](actions/index.md#splat) is allowed (`0` = available). |
| `my_dash_cooldown` | Turns until [dash](actions/index.md#dash) is allowed (`0` = available). |
| `my_paintball_cooldown` | Turns until [paintball](actions/index.md#shoot-paintball) is allowed (`0` = available). |
| `grid` | All hexes on the map (`Hex` values). |
| `tile_pids` | Who paints each hex: `0` = unpainted, `1` / `2` = players. See [tile owner](glossary/index.md#tile-owner). |
| `bots` | Per-player [BotInfo](glossary/index.md#botinfo) (`position`, `facing`, timers). |
| `turn` | Current [turn](glossary/index.md#turn) index. |
| `max_turns` | Match length. |

Imports available in the sandbox: **`utils.hex_grid`** and **`utils.actions`** (see [Utilities](utilities/index.md)).

[← Docs home](index.md) · [Examples →](examples/index.md) · [Debugging →](debugging/index.md)
