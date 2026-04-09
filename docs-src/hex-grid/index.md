# Hexagonal Grids

Splatbot is played on a hexagonal grid. This makes the gameplay more interesting, but can take a little getting used to.

## Coordinate Systems

A coordinate system is a standard variation of some set of **"coordinates"** (one or more numbers that help describe where something is). These numbers are placed along **"axes"**. An axis is the line that exists where all but one of the coordinates are equal to 0. For example, an x/y/z grid has an x axis (where y,z=0), a y axis (where x,z=0), and a z axis (where x,y=0). Axes intersect at the **"origin"** - the position where _all_ coordinates are equal to 0.

### Cartesian (Square Grids)

The most common coordinate system is the **"Cartesian coordinate system"** (named after its inventor, René Descartes). In 2 dimensions, the Cartesian coordinates consist of 2 axes - `x` and `y`. However, this only works well for a square system, as the x and y axes are perpendicular. It cannot apply to hexagons without a little more work.

<!-- TODO: interactive example -->

### Cubic

One approach for creating a hexagonal coordinate system would be to draw an imaginary line through the grid of hexagons in the three directions (Northeast/Southwest, East/West, and Southeast/Northwest) that a line could pass through the grid. This is known as the **"Cubic coordinate system"**. _See the widget below for an interactive example._

These three axes aren't quite the same as the `x`,`y`,`z` seen in a regular 3D space, so they will need new names. By convention, they are called `q`,`r`,`s`. The `q` coordinate will track how far Southeast-Northwest a hexagon is, and so on for `r` (East-West) and `s` (Northeast-Southwest).

### Axial

The cubic coordinate system for hexagons has an interesting property: `q+r+s=0` an identity that holds true for every single hexagonal tile. A single hexagonal tile's position can be full expressed using only 2 of the three cubic axes. This is known as the **"Axial Coordinate System"**. By convention, `q` and `r` are used. Just by knowing those two values, a tile's `s` coordinate can be found using the same identity (`q+r+s=0`, or `s=-q-r`). The axial coordinate system is the one used by Splatbot.

### Example

Hover a hex in either map below to see its coordinates. The colored lines connect hexes that share the same coordinate value: the <span class="hex-axis-q">q</span> line runs Southeast–Northwest, the <span class="hex-axis-r">r</span> line runs East–West, and (in the cubic map) the <span class="hex-axis-s">s</span> line runs Northeast–Southwest.

<div class="hex-hover-demo" data-hex-hover-demo data-hex-radius="3" role="region" aria-label="Hex coordinate hover map">
  <div class="hex-hover-demo-grid">
    <div>
      <p class="hex-hover-title">Full (Cubic) Coordinates (<span class="hex-axis-q">q</span>,<span class="hex-axis-r">r</span>,<span class="hex-axis-s">s</span>)</p>
      <div class="hex-hover-map" data-hex-map-qrs aria-hidden="true"></div>
      <p class="hex-hover-readout hex-hover-readout--inline" data-hex-readout><span class="hex-axis-q">q=</span> <span class="hex-axis-value">?</span> <span class="hex-axis-r">r=</span> <span class="hex-axis-value">?</span> <span class="hex-axis-s">s=</span> <span class="hex-axis-value">?</span></p>
    </div>
    <div>
      <p class="hex-hover-title">Axial Coordinates (<span class="hex-axis-q">q</span>,<span class="hex-axis-r">r</span>)</p>
      <div class="hex-hover-map" data-hex-map-qr aria-hidden="true"></div>
      <p class="hex-hover-readout hex-hover-readout--inline" data-hex-readout-qr><span class="hex-axis-q">q=</span> <span class="hex-axis-value">?</span> <span class="hex-axis-r">r=</span> <span class="hex-axis-value">?</span></p>
    </div>
  </div>
</div>

## Hex Directions

A hexagonal grid has 6 directions: East, Northeast, Northwest, West, Southwest, and Southeast. There is a utility built in to the Splatbot game called [HexDirection](../api-docs/utils/hex_grid.md#hexdirection) that explicitly lists these directions.

| Name | Enum Value | Axial offset (q, r) |
| ---- | ---------- | ------------------- |
| E    | 0          | (+1, 0)             |
| NE   | 1          | (+1, −1)            |
| NW   | 2          | (0, −1)             |
| W    | 3          | (−1, 0)             |
| SW   | 4          | (−1, +1)            |
| SE   | 5          | (0, +1)             |

Directions are numbered **counterclockwise** starting from east. Turning **left** (counterclockwise on the map) increments the direction index (E → NE → NW → ...); turning **right** (clockwise on the map) decrements it (E → SE → SW → ...). Everything wraps mod 6.

The `HEX_DIRECTIONS` list maps each direction index to its `HexVector` offset, so `HEX_DIRECTIONS[HexDirection.E]` is `HexVector(1, 0)`.

```python
from utils.hex_grid import HexDirection

opposite = (HexDirection.E + 3) % 6  # 3 → W
clockwise = (HexDirection.E - 1) % 6  # 5 → SE
```

# UNDER CONSTRUCTION
The rest of this article is still being polished. Information is provided now for your convenience, but is subject to change. For another well-made write up, consider checking out [this article by redblob games](https://www.redblobgames.com/grids/hexagons/).

## Neighbors

Every hex has exactly **six neighbors**, one in each direction. No diagonals, no ambiguity about adjacency — if two hexes share an edge, they're neighbors.

`hex_neighbor(pos, direction)` returns the single neighbor in a given direction. `hex_neighbors(pos)` returns all six, in direction order (E through SE):

```python
from utils.hex_grid import Hex, hex_neighbor, hex_neighbors, HexDirection

pos = Hex(0, 0)
east_neighbor = hex_neighbor(pos, HexDirection.E)  # Hex(1, 0)
all_six = hex_neighbors(pos)
# [Hex(1,0), Hex(1,-1), Hex(0,-1), Hex(-1,0), Hex(-1,1), Hex(0,1)]
```

A common pattern — check whether a neighbor is inside the grid before acting on it:

```python
target = hex_neighbor(game_state.me.position, HexDirection.E)
if target in game_state.grid:
    # safe to consider moving there
```

## Distance

Distance on a hex grid is the **minimum number of steps** to get from one hex to another. Unlike a square grid, moving "diagonally" doesn't cost extra — all six neighbor directions cover equal ground.

`hex_distance(a, b)` computes this:

```python
from utils.hex_grid import Hex, hex_distance

a = Hex(0, 0)
b = Hex(3, 0)
hex_distance(a, b)  # 3 — three steps east

c = Hex(2, -2)
hex_distance(a, c)  # 2 — two steps northeast
```

### Distance rings (cube coordinates)

Hover a hex to treat it as the **origin**. Pick a ring distance **N** from the menu: every tile with `hex_distance(origin, tile) === N` is highlighted — that is the **ring** at distance N. Each ring tile shows its absolute `(q,r,s)` on the first line and `(Δq, Δr, Δs)` from the origin on the second. The **Δ** line uses the same colors as the cubic map: whichever of `|Δq|`, `|Δr|`, `|Δs|` is largest equals the distance (they can tie).

<div class="hex-hover-demo hex-dist-demo" data-hex-dist-demo data-hex-radius="4" role="region" aria-label="Hex distance ring explorer">
  <div class="hex-dist-toolbar">
    <label class="hex-dist-label">Ring distance <span class="hex-axis-value">N</span>
      <select data-hex-dist-n aria-label="Ring distance N"></select>
    </label>
  </div>
  <div class="hex-hover-map" data-hex-dist-map aria-hidden="true"></div>
  <p class="hex-hover-readout hex-hover-readout--inline" data-hex-dist-readout><span class="hex-axis-q">Origin</span> <span class="hex-axis-value">—</span> · <span class="hex-dist-ring-label">Ring <span class="hex-axis-value">N</span>=</span> <span class="hex-axis-value">1</span></p>
</div>

A useful rule of thumb: hex distance equals **max(|dq|, |dr|, |dq + dr|)** where dq and dr are the coordinate differences between the two hexes.

### Vector arithmetic

Positions and offsets support simple math. A `HexVector(dq, dr)` represents a displacement — add it to a `Hex` to get a new position:

```python
from utils.hex_grid import Hex, HexVector

pos = Hex(2, -1)
offset = HexVector(1, 0)   # one step east
new_pos = pos + offset      # Hex(3, -1)
```

You can subtract positions to get the offset between them, or multiply a vector by a scalar to scale it:

```python
from utils.hex_grid import Hex, HexVector

a = Hex(0, 0)
b = Hex(3, 0)
diff = b - a                # Hex(3, 0) — three steps east

step = HexVector(1, -1)     # one step northeast
three_steps = step * 3      # HexVector(3, -3)
```
