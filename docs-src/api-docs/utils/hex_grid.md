# hex_grid

Axial hex utilities (pointy-top; axial E/W align with screen right/left). See [this article](../../hex-grid/index.md) for some interactive examples of how to effectively utilize these helpers.

**Exports:** Hex, HexVector, HexDirection, HEX_DIRECTIONS, HexUtils

## Hex

Immutable cell coordinate. Equality and hash use only (q, r); controller is ignored.

### Attributes

| Attribute  | Type                                              | Description                                                                       |
| ---------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| q          | int                                               | Axial q coordinate.                                                               |
| r          | int                                               | Axial r coordinate.                                                               |
| controller | [BotInfo](splatbot_data_types.md#botinfo) or None | Tile owner from the snapshot; None for arithmetic-built hexes or unpainted tiles. |

### Methods

| Method                       | Returns | Description                                                                              |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| \_\_add\_\_(other)           | Hex     | other is [Hex](#hex) or [HexVector](#hexvector). Sum; result has no controller.          |
| \_\_radd\_\_(other)          | Hex     | Right-hand addition.                                                                     |
| \_\_sub\_\_(other)           | Hex     | Difference; result has no controller.                                                    |
| \_\_rsub\_\_(other)          | Hex     | Right-hand subtraction.                                                                  |
| \_\_repr\_\_()               | str     | String form includes q and r.                                                            |
| is_controlled_by(bot_or_pid) | bool    | True if controller matches [BotInfo](splatbot_data_types.md#botinfo) (by ==) or int pid. |

## HexVector

Immutable axial offset (dq, dr). Hashable by (q, r).

### Attributes

| Attribute | Type | Description |
| --------- | ---- | ----------- |
| q         | int  | Delta q.    |
| r         | int  | Delta r.    |

### Methods

| Method                                                         | Returns   | Description                                                                                               |
| -------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| \_\_add\_\_(other)                                             | HexVector | Vector sum.                                                                                               |
| \_\_sub\_\_(other)                                             | HexVector | Vector difference.                                                                                        |
| \_\_mul\_\_(scalar)                                            | HexVector | Integer scale.                                                                                            |
| \_\_rmul\_\_(scalar)                                           | HexVector | Scalar on the left.                                                                                       |
| \_\_repr\_\_()                                                 | str       | String form includes q and r.                                                                             |
| from_direction_and_distance(direction, distance) (classmethod) | HexVector | Step along direction (int or [HexDirection](#hexdirection)), length distance; direction normalized mod 6. |

## HexDirection

Integer enum of neighbor directions (0 = +q, east on screen).

### Enum members

| Member | Value |
| ------ | ----- |
| E      | 0     |
| NE     | 1     |
| NW     | 2     |
| W      | 3     |
| SW     | 4     |
| SE     | 5     |

Integer values match indices in [HEX_DIRECTIONS](#hex_directions). APIs that take int or HexDirection typically normalize with mod 6.

## HEX_DIRECTIONS

| Name           | Type                            | Description                                                                |
| -------------- | ------------------------------- | -------------------------------------------------------------------------- |
| HEX_DIRECTIONS | list of [HexVector](#hexvector) | Axial step for each [HexDirection](#hexdirection), same order as the enum. |

## HexUtils

Grid helpers bound to one [GameState](splatbot_data_types.md#gamestate) snapshot (game_state is stored for methods that need the board).

### Attributes

| Attribute  | Type                                          | Description                    |
| ---------- | --------------------------------------------- | ------------------------------ |
| game_state | [GameState](splatbot_data_types.md#gamestate) | The snapshot passed to decide. |

### Methods

| Method                     | Returns                                           | Description                                                                                     |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| \_\_init\_\_(game_state)   | None                                              | Bind helpers to game_state.                                                                     |
| hex_neighbor(h, direction) | Hex                                               | Neighbor of [Hex](#hex) h; direction is int or [HexDirection](#hexdirection), normalized mod 6. |
| hex_neighbors(h)           | list of Hex                                       | Six neighbors in enum order (E through SE).                                                     |
| in_grid_neighbors(h)       | list of Hex                                       | Neighbors that exist in game_state.grid (actual tile objects, including controller).            |
| hex_at(h)                  | [Hex](#hex) or None                               | Grid tile equal to h, or None if off-map.                                                       |
| hex_controller(h)          | [BotInfo](splatbot_data_types.md#botinfo) or None | Controller of the tile at h.                                                                    |
| hex_distance(a, b)         | int                                               | Axial cube distance between two hexes.                                                          |

---

Commented helpers in source (generate_hex_grid, axial_to_pixel, hex_corners) are not part of the sandbox API.
