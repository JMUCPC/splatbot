# Writing bots

# TODO: fix this page

Bots are Python scripts that define a `decide(game_state)` function.

## Imports

Inside the browser sandbox you can use:

- `utils.hex_grid` (e.g. `HexDirection`)
- `utils.actions` (`Actions`)

## Example

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection

def decide(game_state):
    return Actions.move(HexDirection.E)
```

## Game state

Useful fields on `game_state`:

| Field | Meaning |
| ------ | ------- |
| `my_pid` | This bot’s player id (`1` or `2`) |
| `grid` | `frozenset` of hex tiles |
| `tile_pids` | `dict` mapping tile → owner (`0` = unpainted) |
| `bots` | `dict` of `BotInfo` (position, facing, …) |
| `turn` | Current turn |
| `max_turns` | Match length |

See the main [README](../../README.md) for more detail, or [Architecture](../architecture/overview/) for the big picture.
