# Utilities

Bots run in a small Python sandbox. You may **`import`** from the **`utils`** package only (plus normal Python builtins). In practice you almost always use:

- **`utils.hex_grid`** — hex coordinates, directions, helpers like `hex_neighbor`.
- **`utils.actions`** — `Actions.move()`, `Actions.face_direction()`, etc. (see [Actions](../actions/)).

If you open this project’s source code, `python/utils/` is the same logic copied into the browser for Pyodide; you do not need the repo to write a bot in the game.

## HexDirection

The map is a **pointy-top** hex grid using **axial** coordinates (`q`, `r`) — see [`Hex`](../glossary/index.md#hex) in the [glossary](../glossary/). There are six neighbor directions, named like compass points on the hex:

| Name | Often used as |
| ---- | ------------- |
| `E` | screen right |
| `W` | screen left |
| `NE`, `NW`, `SE`, `SW` | the four diagonals on the hex lattice |

Use `HexDirection` with `Actions.face_direction(...)`, `hex_neighbor`, and when comparing to `game_state.bots[pid].facing`. You can also use integers `0`–`5` where an API accepts `int | HexDirection` (names are clearer).

**Motion:** `Actions.move()`, `Actions.dash(distance)`, and `Actions.shoot_paintball()` use your bot’s current **facing**, not a direction argument — turn first if you need a different heading.

```python
from utils.hex_grid import HexDirection

east = HexDirection.E
north_east = HexDirection.NE
north_west = HexDirection.NW
west = HexDirection.W
south_west = HexDirection.SW
south_east = HexDirection.SE
```

Common helpers (import from `utils.hex_grid`):

- **`hex_neighbor(hex, direction)`** — one step from `hex` in direction `0`–`5` or `HexDirection`.
- **`hex_neighbors(hex)`** — all six neighbors.
- **`hex_distance(a, b)`** — grid distance between two hexes.

For everything your bot receives each turn, see [Writing bots](../writing-bots/).

[← Docs home](../index.md) · [← Back to the game](../../index.html)
