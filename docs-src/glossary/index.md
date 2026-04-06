# Glossary

Short definitions for terms used in these docs. First mention on other pages may use a hover hint (`<abbr>`) or link here for detail.

## Action

One instruction your bot returns from `decide` each time: move, skip, splat, dash, or shoot paintball. See [Actions](../actions/).

## Axial coordinates

The map uses **axial** `(q, r)` integer pairs for each hex (`Hex` in code). You rarely need the math; use helpers like `hex_neighbor`. See [Utilities](../utilities/).

## BotInfo

Read-only view of one bot in `game_state.bots[pid]`: `position` (`Hex`), `facing`, and per-bot timers (`stun`, cooldown fields). Use `game_state.bots[game_state.my_pid]` for yourself.

## Browser console

The **developer tools** panel where `print()` from your bot can appear (Python runs in a background worker). Not the same as the in-game **event log**. See [Debugging](../debugging/#print-and-the-browser-console).

## Cooldown

After some actions (splat, dash, paintball), a **cooldown** counter must reach `0` before you can use that action again. Check `game_state.my_splat_cooldown`, `my_dash_cooldown`, `my_paintball_cooldown`. Defaults are configurable in **SETTINGS** in the game.

## Event log

The scrollable panel in the Splatbot UI listing match events, errors, and some blocked actions. It is **not** the same as the browser console. See [Debugging](../debugging/#event-log).

## game_state

A **read-only snapshot** passed into `decide(self, game_state)` each turn: your id, stun/cooldowns, the set of hexes, who owns each tile, all bots’ positions, and turn counters. You change the game only by **returning** an action.

## Hex

One cell on the map, identified by axial coordinates. See [Utilities](../utilities/).

## Player id

`1` or `2` — which side this script controls. Available as `game_state.my_pid` and as keys in `game_state.bots`.

## Pyodide

The in-browser Python runtime used to run your bot. Implementation detail; you write normal Python with the allowed imports.

## Stun

After splat or paintball (and optionally dash), you may be **stunned** for several turns: you cannot move, dash, splat, or shoot paintball until `game_state.my_stun` is `0`. You **can** still `Actions.skip()`.

## Tick

One **simulation step** in the UI: the turn counter advances, **both** players’ `decide` methods run (in order), then collisions resolve. Stepping the game one **tick** at a time is different from watching it run continuously. See [Debugging](../debugging/#step).

## Tile owner

`game_state.tile_pids` maps each `Hex` to `0` (unpainted), `1`, or `2`. Use it to see who paints a tile.

## Turn

The current step of the match, exposed as `game_state.turn` (and `max_turns` for length). Related to but not identical to a **tick**; see above.

## Web Worker

A background thread where your Python runs so the page stays responsive. Your `print` output may show under the worker in the browser’s developer tools. See [Debugging](../debugging/#print-and-the-browser-console).

[← Docs home](../) · [← Back to the game](../../index.html)
