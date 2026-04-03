# Writing bots

Bots are Python scripts that define a `class Bot` with a `decide(self, game_state)` method.

## Imports

Inside the browser sandbox you can use:

- `utils.hex_grid` (e.g. `HexDirection`)
- `utils.actions` (`Actions`)

## Example

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        return Actions.move(HexDirection.E)
```

## Actions

- `Actions.move(HexDirection)` — step to an adjacent hex (and paint it).
- `Actions.skip()` — no effect.
- `Actions.splat()` — paint every **in-grid** neighbor of your current hex (not the tile you stand on). After splat: **3 turns** where you cannot move or splat (`my_splat_cooldown`), and a separate **10-turn** timer before you may splat again (`my_splat_interval`; at most one splat every 10 turns). You may still `skip()` during the 3-turn lockout.
- `Actions.dash(direction, distance)` — dash **2-6** hexes in `direction` and paint **only the destination** hex (if that would leave the map, you stop at the **edge**). A bot can dash once every **7 turns**; check `game_state.my_dash_interval` (`0` = dash available).

## Game state

Useful fields on `game_state`:

| Field | Meaning |
| ------ | ------- |
| `my_pid` | This bot’s player id (`1` or `2`) |
| `my_splat_cooldown` | Turns before `move` / `splat` allowed after splat (`0` = not in 3-turn lockout) |
| `my_splat_interval` | Turns until `splat` is allowed again (`0` = splat available; one splat every **10** turns) |
| `my_dash_interval` | Turns until `dash` is allowed again (`0` = dash available; one dash every **7** turns) |
| `grid` | `frozenset` of hex tiles |
| `tile_pids` | `dict` mapping tile → owner (`0` = unpainted) |
| `bots` | `dict` of `BotInfo` (`position`, `facing`, `splat_cooldown`, `splat_interval`, `dash_interval`) |
| `turn` | Current turn |
| `max_turns` | Match length |

`Bot` is constructed once when your script loads (per bot worker). Use `self` on the instance to remember anything you need between turns.

See the main [README](../../README.md) for more detail, or [Architecture](../architecture/overview/) for the big picture.
