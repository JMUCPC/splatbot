# `utils.hex_grid` API Reference

Axial-coordinate utilities for the hex board. The engine uses **pointy-top** hexes; axial **E/W** line up with screen **right/left** (+x / −x). See [Red Blob Games — Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/) for background.

## Module exports (public API)

- `Hex`
- `HexVector`
- `HexDirection`
- `HEX_DIRECTIONS`
- `HexUtils`

---

## `Hex`

```python
class Hex:
    """Axial (q, r) hex coordinate with optional tile-ownership controller."""
    q: int
    r: int
    controller: BotInfo | None  # None = unpainted; set by the sandbox snapshot
```

**Fields**

- `q: int` — axial q component.
- `r: int` — axial r component.
- `controller: BotInfo | None` — the bot that controls (paints) this tile, or `None` if unpainted. Set automatically in `game_state.grid`; defaults to `None` for hexes created by arithmetic or helper methods.

**Equality and hashing** use **only `(q, r)`** — `controller` is excluded. This means `HexUtils(game_state).hex_neighbor(pos, d) in game_state.grid` works regardless of controller state, and `Hex` is suitable for use in sets and as dict keys.

**Methods**

- `__add__(other: Hex | HexVector) -> Hex` — component-wise sum; supports adding either a position (`Hex`) or offset (`HexVector`); returns a new `Hex` (controller is `None`).
- `__radd__(other: Hex | HexVector) -> Hex` — right-side addition hook for symmetric arithmetic usage.
- `__sub__(other: Hex | HexVector) -> Hex` — component-wise difference against either a position (`Hex`) or offset (`HexVector`); returns a new `Hex` (controller is `None`).
- `__rsub__(other: Hex | HexVector) -> Hex` — right-side subtraction hook.
- `__repr__() -> str` — e.g. `Hex(0, -1)`.
- `is_controlled_by(bot_or_pid: BotInfo | int) -> bool` — returns `True` when this tile is controlled by the given bot or player id. Returns `False` if `controller` is `None`. When given an `int`, compares to `controller.pid`. When given a `BotInfo`, uses `BotInfo.__eq__`.

```python
for hex in game_state.grid:
    if hex.is_controlled_by(game_state.me):
        print(f"{hex} is mine!")
```

---

## `HexVector`

```python
class HexVector:
    """Immutable axial vector offset (dq, dr)."""
    q: int
    r: int
```

Represents an axial displacement (not tile ownership state). Useful for direction/offset math and as entries in `HEX_DIRECTIONS`.

**Methods**

- `__add__(other: HexVector) -> HexVector` — vector addition.
- `__sub__(other: HexVector) -> HexVector` — vector subtraction.
- `__mul__(scalar: int) -> HexVector` — integer scalar multiply.
- `__rmul__(scalar: int) -> HexVector` — supports `n * vector`.
- `__repr__() -> str` — e.g. `HexVector(1, -1)`.
- `from_direction_and_distance(direction: int | HexDirection, distance: int) -> HexVector` — class helper that returns the directional offset `distance` steps away, with direction normalized by `% 6`.

Like `Hex`, `HexVector` is immutable and hashable by `(q, r)`.

---

## `HexDirection`

```python
class HexDirection(IntEnum):
    """Axial neighbor directions; 0 = +q (E). Screen: E → right, W → left."""

    E = 0
    NE = 1
    NW = 2
    W = 3
    SW = 4
    SE = 5
```

Integer enum values match indices into `HEX_DIRECTIONS` and are accepted wherever a direction is passed as `int | HexDirection` (for example `Actions.face_direction`, `HexUtils.hex_neighbor` — typically normalized with `% 6`).

---

## `HEX_DIRECTIONS`

```python
HEX_DIRECTIONS: list[HexVector] = [
    HexVector(1, 0),   # 0 — E
    HexVector(1, -1),  # 1 — NE
    HexVector(0, -1),  # 2 — NW
    HexVector(-1, 0),  # 3 — W
    HexVector(-1, 1),  # 4 — SW
    HexVector(0, 1),   # 5 — SE
]
```

Axial step vector for each `HexDirection` value (same order as the enum).

---

## `HexUtils`

```python
class HexUtils:
    game_state: GameState  # read-only snapshot passed to Bot.decide

    def __init__(self, game_state: GameState) -> None: ...

    def hex_neighbor(self, h: Hex, direction: int | HexDirection) -> Hex: ...
    def hex_neighbors(self, h: Hex) -> list[Hex]: ...
    def in_grid_neighbors(self, h: Hex) -> list[Hex]: ...
    def hex_at(self, h: Hex) -> Hex | None: ...
    def hex_controller(self, h: Hex) -> BotInfo | None: ...
    def hex_distance(self, a: Hex, b: Hex) -> int: ...
```

Construct once per call to `decide` (or whenever you have a current snapshot). The `game_state` argument is the same object the sandbox passes to `decide`; it is stored on `HexUtils.game_state` for helpers that need map or player context.

### `hex_neighbors`

Returns the six neighboring hexes of `h`, one per `HexDirection`, in enum order (`E` through `SE`).

### `hex_neighbor`

Returns the neighbor of `h` in the given direction. The direction is taken as `int(direction) % 6`, so integer values wrap modulo 6.

### `in_grid_neighbors`

Returns only the neighbors of `h` that exist in `game_state.grid`.

### `hex_at`

Returns the matching tile object from `game_state.grid` for coordinate `h`, or `None` if `h` is outside the map.

### `hex_controller`

Returns the controlling `BotInfo` for tile `h`, or `None` if the tile is unpainted or not in the map.

### `hex_distance`

Returns the **axial cube distance** between two hexes (integer steps on the hex grid).

---

## Commented-out helpers (source only)

The shipped `utils/hex_grid.py` file also contains commented definitions for `generate_hex_grid`, `axial_to_pixel`, and `hex_corners`. They are **not** part of the live module API in the sandbox; do not rely on them unless your project enables that code.
