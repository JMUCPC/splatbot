# Game state (`game_state`) API Reference

`Bot.decide(self, game_state)` receives a **read-only snapshot** of the match. It is built in the Pyodide worker from JSON and is **not** a module you import; attribute assignment raises `AttributeError` (including on nested `bots` and `tile_pids` mappings).

Conceptually it matches the data described below. Names follow the Python attributes used in the worker (`snake_case` cooldown fields).

## Type overview

```python
# Illustrative — actual class is injected by the sandbox; read-only.
class GameStateSnapshot:
    my_pid: int
    my_stun: int
    my_splat_cooldown: int
    my_dash_cooldown: int
    my_paintball_cooldown: int
    grid: frozenset[Hex]
    tile_pids: Mapping[Hex, int]
    bots: Mapping[int, BotInfo]
    turn: int
    max_turns: int
```

`Hex` and bot entries use types from [`utils.hex_grid`](utils/hex_grid.md) and [Bot info](bot_data.md).

---

## Fields

### `my_pid: int`

Your player id (`1` or `2` in a two-player match).

### `my_stun: int`

Turns remaining during which **move**, **dash**, **splat**, **shoot_paintball**, and **turning** (`turn_left`, `turn_right`, `face_direction`, `turn_180`) are blocked for your bot (**skip** is still allowed). Same semantics as `game_state.bots[my_pid].stun`; exposed for convenience.

### `my_splat_cooldown: int`

Turns until **splat** is allowed again for your bot (0 means ready). Mirrors `game_state.bots[my_pid].splat_cooldown`.

### `my_dash_cooldown: int`

Turns until **dash** is allowed again for your bot. Mirrors `game_state.bots[my_pid].dash_cooldown`.

### `my_paintball_cooldown: int`

Turns until **shoot_paintball** is allowed again for your bot. Mirrors `game_state.bots[my_pid].paintball_cooldown`.

### `grid: frozenset[Hex]`

All hex cells that exist on the map (in-bounds tiles). Use this to test whether a coordinate is on the board.

### `tile_pids: Mapping[Hex, int]`

Paint ownership per hex: maps each `Hex` to a player id. **`0`** means **unpainted**; `1` and `2` mean painted by that player. The mapping is read-only (`types.MappingProxyType`).

### `bots: Mapping[int, BotInfo]`

Per-player state keyed by player id. Values are read-only bot info objects; see [Bot info](bot_data.md).

### `turn: int`

Current turn index provided by the engine (same field name as in the serialized snapshot).

### `max_turns: int`

Maximum turns for the match (game ends when `turn` reaches this, per engine rules).

---

## Construction note

The worker parses JSON from the main thread, builds `Hex` / `HexDirection` values, wraps `tile_pids` and `bots` in read-only mappings, and passes the result to `decide`. You should treat `game_state` as an immutable view of the world for that call.
