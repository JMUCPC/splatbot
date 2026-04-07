# `utils.hex_grid` API Reference

Axial-coordinate utilities for the hex board. The engine uses **pointy-top** hexes; axial **E/W** line up with screen **right/left** (+x / −x). See [Red Blob Games — Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/) for background.

## Module exports (public API)

- `Hex`
- `HexDirection`
- `HEX_DIRECTIONS`
- `hex_neighbors`
- `hex_neighbor`
- `hex_distance`

---

## `Hex`

```python
@dataclass(frozen=True)
class Hex:
    """Axial (q, r) hex coordinate. Immutable and hashable."""
    q: int
    r: int
```

**Fields**

- `q: int` — axial q component.
- `r: int` — axial r component.

**Methods**

- `__add__(other: Hex) -> Hex` — component-wise sum; returns a new `Hex`.
- `__sub__(other: Hex) -> Hex` — component-wise difference; returns a new `Hex`.
- `__repr__() -> str` — e.g. `Hex(0, -1)`.

`Hex` is suitable for use in sets and as dict keys (frozen dataclass).

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

Integer enum values match indices into `HEX_DIRECTIONS` and are accepted wherever a direction is passed as `int | HexDirection` (for example `Actions.face_direction`, `hex_neighbor` — typically normalized with `% 6`).

---

## `HEX_DIRECTIONS`

```python
HEX_DIRECTIONS: list[Hex] = [
    Hex(1, 0),   # 0 — E
    Hex(1, -1),  # 1 — NE
    Hex(0, -1),  # 2 — NW
    Hex(-1, 0),  # 3 — W
    Hex(-1, 1),  # 4 — SW
    Hex(0, 1),   # 5 — SE
]
```

Axial step vector for each `HexDirection` value (same order as the enum).

---

## `hex_neighbors`

```python
def hex_neighbors(h: Hex) -> list[Hex]
```

Returns the six neighboring hexes of `h`, one per `HexDirection`, in enum order (`E` through `SE`).

---

## `hex_neighbor`

```python
def hex_neighbor(h: Hex, direction: int | HexDirection) -> Hex
```

Returns the neighbor of `h` in the given direction. The direction is taken as `int(direction) % 6`, so integer values wrap modulo 6.

---

## `hex_distance`

```python
def hex_distance(a: Hex, b: Hex) -> int
```

Returns the **axial cube distance** between two hexes (integer steps on the hex grid).

---

## Commented-out helpers (source only)

The shipped `utils/hex_grid.py` file also contains commented definitions for `generate_hex_grid`, `axial_to_pixel`, and `hex_corners`. They are **not** part of the live module API in the sandbox; do not rely on them unless your project enables that code.
