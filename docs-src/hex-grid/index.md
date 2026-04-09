# Hexagonal Grids

Splatbot's arena is a hexagonal grid, not a square one. If you've only worked with square grids before, hexes take a little getting used to — but the payoff is worth it. Every tile connects to exactly **six neighbors** at equal distances, there are no awkward diagonals, and movement feels natural in all directions.

This page covers the essentials: how coordinates work, the six directions your bot can face, and how to think about distance and neighbors. Along the way you'll see the utility functions available in `utils.hex_grid` — for full API details, see the [API reference](../api-docs/utils/hex_grid.md).

## Axial coordinates

Each hex tile has two coordinates: **q** and **r**. This is called the **axial coordinate system**.

- The **q axis** runs **east–west**. Moving east increases q; moving west decreases it.
- The **r axis** runs roughly **northwest–southeast**. Moving southeast increases r; moving northwest decreases it.
- There's an implied third axis, **s = −q − r**, which you rarely need directly.

The center of the grid is `(0, 0)`. Your bot's position is always a `Hex(q, r)` object — you can read `game_state.me.position.q` and `.r` at any time.

### Moving along the q axis

<div class="action-demo" data-action-demo="hex-move-east" role="region" aria-label="Move east example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Bot at <strong>(0, 0)</strong> moves east → lands on <strong>(1, 0)</strong>. Only q changed (+1); r stayed the same.</p>
</div>

### Moving along the r axis

<div class="action-demo" data-action-demo="hex-move-nw" role="region" aria-label="Move northwest example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Bot at <strong>(0, 0)</strong> moves northwest → lands on <strong>(0, −1)</strong>. Only r changed (−1); q stayed the same.</p>
</div>

### Moving along both axes

<div class="action-demo" data-action-demo="hex-move-ne" role="region" aria-label="Move northeast example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Bot at <strong>(0, 0)</strong> moves northeast → lands on <strong>(1, −1)</strong>. Both q (+1) and r (−1) changed.</p>
</div>

The key insight: **east/west** movement only changes q, **northwest/southeast** only changes r, and **northeast/southwest** changes both. Every direction is a combination of at most two axis changes.

### Hover map: q,r,s vs q,r

Use this to build intuition for the cube coordinate identity `q + r + s = 0`.
Hover any hex on the left map. The right map highlights the same hex, but only shows `q,r`.

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

## Hex directions

Your bot always faces one of **six directions**, numbered 0–5. The `HexDirection` enum gives them readable names:

| Value | Name | Axial offset (q, r) |
|-------|------|---------------------|
| 0     | E    | (+1, 0)             |
| 1     | NE   | (+1, −1)            |
| 2     | NW   | (0, −1)             |
| 3     | W    | (−1, 0)             |
| 4     | SW   | (−1, +1)            |
| 5     | SE   | (0, +1)             |

Directions are numbered **counterclockwise** starting from east. Turning **left** (counterclockwise on the map) increments the direction index (E → NE → NW → ...); turning **right** (clockwise on the map) decrements it (E → SE → SW → ...). Everything wraps mod 6.

The `HEX_DIRECTIONS` list maps each direction index to its `HexVector` offset, so `HEX_DIRECTIONS[HexDirection.E]` is `HexVector(1, 0)`.

```python
from utils.hex_grid import HexDirection

opposite = (HexDirection.E + 3) % 6  # 3 → W
clockwise = (HexDirection.E - 1) % 6  # 5 → SE
```

## Neighbors

Every hex has exactly **six neighbors**, one in each direction. No diagonals, no ambiguity about adjacency — if two hexes share an edge, they're neighbors.

<div class="action-demo" data-action-demo="hex-neighbors" role="region" aria-label="Hex neighbors example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">The bot at <strong>(0, 0)</strong> splats, painting all six neighbors. Each painted tile is exactly one step away in a different direction.</p>
</div>

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

<div class="action-demo" data-action-demo="hex-dash-3" role="region" aria-label="Hex distance example">
<div class="action-demo-grid" aria-hidden="true"></div>
<div class="action-demo-buttons">
<button type="button" class="action-demo-btn" data-demo-play>Play</button>
<button type="button" class="action-demo-btn action-demo-btn--secondary" data-demo-reset>Reset</button>
</div>
<p class="action-demo-caption">Bot dashes 3 hexes east — the distance between start and destination is exactly 3. On a hex grid, distance is simply the step count.</p>
</div>

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
