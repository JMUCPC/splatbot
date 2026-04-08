# Python API reference

These pages describe the types and helpers available to bot scripts in the Splatbot sandbox (`Bot.decide(self, game_state)`).

## Modules (`utils`)

- [`utils.actions`](utils/actions.md) — action datatypes and the `Actions` factory.
- [`utils.hex_grid`](utils/hex_grid.md) — axial hex coordinates, directions, and grid helpers.

## Runtime snapshot types

The following are not `.py` files in the repo; they are constructed inside the Pyodide worker and passed into `decide` as `game_state`. They are read-only (assigning attributes raises).

- [Game state (`game_state`)](game_data.md) — board, turn metadata, and references to your bot and opponents.
- [Bot info (`game_state.me`, `game_state.opponent`)](bot_data.md) — per-player position, facing, and timers.
