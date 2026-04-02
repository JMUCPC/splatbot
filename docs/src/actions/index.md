# Actions:

Actions are the commands that a splatbot can execute. A splatbot can execute exactly one action per turn. The `decide` function should return an instance of an action. To create an action, the `Actions` helper class is provided. The following actions are available:

## Skip

The skip action tells a splatbot to skip a turn.

```python
from utils.actions import Actions

def decide(game_state):
    """ This bot will not do anything. How lazy! """
    return Actions.skip()
```

## Move

The move action tells a splatbot to move in a given direction. The direction given may be either an integer or (recommended) a [HexDirection](../utilities/index.md#hex-direction). A splatbot will move one tile in the given direction, and paint the tile that it lands on. If the movement would result in the splatbot moving to an invalid position, then nothing will happen.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection

def decide(game_state):
    """ This bot will move in a straight line east across the grid. """
    return Actions.move(HexDirection.E)
```
