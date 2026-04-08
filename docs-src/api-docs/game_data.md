# Game state (`game_state`) API Reference

`Bot.decide(self, game_state)` receives a **read-only snapshot** of the match. It is built in the Pyodide worker from JSON and is **not** a module you import; attribute assignment raises `AttributeError`.

Conceptually it matches the data described below. Names follow the Python attributes used in the worker (`snake_case` cooldown fields).

## Type overview

```python
# Illustrative — actual class is injected by the sandbox; read-only.
class GameStateSnapshot:
    pid: int
    me: BotInfo
    opponents: Mapping[int, BotInfo]
    opponent: BotInfo | None
    grid: frozenset[Hex]
    def get_grid_as_2D_list(self) -> list[list[Hex]]: ...
    turn: int
    max_turns: int
```

`Hex` uses types from [`utils.hex_grid`](utils/hex_grid.md). `BotInfo` is described on [Bot info](bot_info.md).

---

## Fields

### `pid: int`

Your player id (`1` or `2` in a two-player match). Same value as `me.pid`.

### `me: BotInfo`

A read-only [BotInfo](bot_info.md) for **your** bot — position, facing, stun, and all cooldowns. This is the primary way to check your own state. Stun counts turns where **move**, **dash**, **splat**, **shoot_paintball**, and **turning** are blocked (**skip** is still allowed).

```python
if game_state.me.stun > 0:
    return Actions.skip()
```

### `opponents: Mapping[int, BotInfo]`

All **other** players in the match, keyed by their player id. Read-only (`types.MappingProxyType`). In a two-player match this contains exactly one entry.

### `opponent: BotInfo | None`

Convenience shortcut: the **single** opponent's `BotInfo` when there is exactly one opponent (the standard 1v1 case). `None` if there are zero or more than one opponents.

```python
opp = game_state.opponent
if opp is not None:
    dist = hex_distance(game_state.me.position, opp.position)
```

### `grid: frozenset[Hex]`

All hex cells on the map. Each `Hex` has a `controller` attribute (`BotInfo | None`) indicating who currently paints that tile (`None` = unpainted). Use `hex.controller` or `hex.is_controlled_by(...)` to check ownership.

```python
for hex in game_state.grid:
    if hex.is_controlled_by(game_state.me):
        ...  # this tile is mine
```

Position checks like `hex_neighbor(pos, d) in game_state.grid` still work — `Hex` equality uses only `(q, r)`, not `controller`.

### `get_grid_as_2D_list() -> list[list[Hex]]`

Returns the same tiles as `game_state.grid`, laid out as a nested list using axial coordinates:

- Outer list is rows by `r` in ascending order.
- Inner list is columns by `q` in ascending order for that row.
- No filler/placeholder cells are added.

```python
rows = game_state.get_grid_as_2D_list()
for row in rows:
    for hex in row:
        ...
```

### `turn: int`

Current turn index provided by the engine (same field name as in the serialized snapshot).

### `max_turns: int`

Maximum turns for the match (game ends when `turn` reaches this, per engine rules).

---

## Construction note

The worker parses JSON from the main thread, builds `Hex` / `HexDirection` values with resolved `controller` references, and passes the result to `decide`. You should treat `game_state` as an immutable view of the world for that call.
