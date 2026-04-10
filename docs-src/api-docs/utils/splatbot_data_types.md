# `utils.splatbot_data_types` API Reference

Typing-only template datatypes for editor hints and static checking.

These classes are included in starter downloads as a reference for bot authors. The runtime `game_state` object is still constructed by the sandbox worker and is read-only.

## Module exports (public API)

- `BotInfo`
- `GameState`

---

## `BotInfo`

```python
@dataclass(frozen=True)
class BotInfo:
    pid: int
    position: Hex
    facing: HexDirection
    stun: int = 0
    splat_cooldown: int = 0
    dash_cooldown: int = 0
    paintball_cooldown: int = 0
```

Template shape for per-player state exposed on `game_state` (`game_state.me`, values in `game_state.opponents`, and `game_state.opponent` in 1v1).

---

## `GameState`

```python
@dataclass(frozen=True)
class GameState:
    me: BotInfo
    opponents: MappingProxyType[int, BotInfo]
    opponent: BotInfo | None
    grid: frozenset[Hex]
    turn: int
    max_turns: int

    def get_grid_as_2D_list(self) -> list[list[Hex]]: ...
```

Template shape for the read-only snapshot passed to `Bot.decide(self, game_state)`.

Use `game_state.me.pid` as the player id source.

### `get_grid_as_2D_list`

Returns grid tiles grouped by axial rows (`r` ascending), then sorted by `q` within each row.

---

## Notes

- This module is for typing/reference; it does not create or mutate runtime sandbox objects.
- Runtime semantics are documented in [Game state (`game_state`)](../game_data.md) and [Bot info](../bot_info.md).
