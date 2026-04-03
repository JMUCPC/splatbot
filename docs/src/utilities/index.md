# Utilities

Python bots can import **`utils`** modules inside the Pyodide sandbox. The usual pair is **`utils.hex_grid`** (coordinates and directions) and **`utils.actions`** (see the [Actions](../actions/) page).

## HexDirection

The map uses a **pointy-top** axial hex grid. There are six neighbor directions: **`E`**, **`NE`**, **`NW`**, **`W`**, **`SW`**, **`SE`**. Pass them to `Actions.move` (or an equivalent integer `0`–`5`).

```python
from utils.hex_grid import HexDirection

east = HexDirection.E
north_east = HexDirection.NE
north_west = HexDirection.NW
west = HexDirection.W
south_west = HexDirection.SW
south_east = HexDirection.SE
```

For the full snapshot your bot receives each turn, see [Writing bots](../writing-bots/).
