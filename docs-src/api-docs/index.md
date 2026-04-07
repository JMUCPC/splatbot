# Python API reference

These pages describe the types and helpers available to bot scripts in the Splatbot sandbox (`Bot.decide(self, game_state)`).

## Modules (`utils`)

- [`utils.actions`](utils/actions/index.md) — action datatypes and the `Actions` factory.
- [`utils.hex_grid`](utils/hex_grid/index.md) — axial hex coordinates, directions, and grid helpers.

## Runtime snapshot types

The following are not `.py` files in the repo; they are constructed inside the Pyodide worker and passed into `decide` as `game_state`. They are read-only (assigning attributes raises).

- [Game state (`game_state`)](game_data/index.md) — board, scores-by-tile, turn metadata, and your bot’s cooldowns.
- [Bot info (`game_state.bots[pid]`)](bot_data/index.md) — per-player position, facing, and timers.
