# Example Bots

Full scripts below, then a short **how it works** list. Assumes you have read [Writing bots](../writing-bots/) and skimmed [Actions](../actions/).

## Ping-pong (forward until a wall)

Same idea as on the writing-bots page, with a bit more narration.

```python
from utils.actions import Actions
from utils.hex_grid import HexUtils


class Bot:
    def decide(self, game_state):
        # Snapshot of this bot: position on the hex grid and which way it faces.
        player = game_state.me
        hex_utils = HexUtils(game_state)

        # One step straight ahead in the current facing direction.
        neighbor_ahead = hex_utils.hex_neighbor(player.position, player.facing)

        # If we would leave the map, turn around; otherwise keep walking forward.
        if neighbor_ahead not in game_state.grid:
            return Actions.turn_180()
        return Actions.move()
```

**How it works**

1. Look up this bot's position and facing (here stored in `player`): `player.position`, `player.facing`.
2. Build `HexUtils(game_state)` and compute the hex straight ahead using `hex_utils.hex_neighbor(position, facing)`.
3. If that hex is **not** on the map (`not in game_state.grid`), **turn 180°**; otherwise **move** forward.

**Takeaways:** `HexUtils`, `game_state.grid`, `Actions.turn_180()`, and moving relative to `facing` (works for both players).

## Random move, turn, and specials

Each turn, pick **uniformly at random** among **move**, a **random `turn_left`** (1–5 steps), and each **special** whose cooldown is **0** (`splat`, `dash`, `shoot_paintball`). Skips while stunned.

```python
"""Pick splat, dash, or paintball at random when each cooldown allows; otherwise move."""

import random

from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        # Skip if stunned
        player = game_state.me
        if player.stun > 0:
            return Actions.skip()

        # Create a list of actions this bot may take
        action_choices = [Actions.move()]

        # Add an action to turn in a random direction
        turn = Actions.turn_left(random.randint(1, 5))
        action_choices.append(turn)

        # Add splat action if off cooldown
        if player.splat_cooldown == 0:
            splat = Actions.splat()
            action_choices.append(splat)

        # Add dash action if off cooldown
        if player.dash_cooldown == 0:
            distance = random.randint(2, 6) # can dash anywhere between 2-6 tiles
            dash = Actions.dash(distance)
            action_choices.append(dash)

        # Add paintball action if off cooldown
        if player.paintball_cooldown == 0:
            paintball = Actions.shoot_paintball()
            action_choices.append(paintball)

        # randomly choose one of the valid actions
        chosen_action = random.choice(action_choices)
        return chosen_action
```

**How it works**

1. While stunned, use `skip` (`player.stun > 0`).
2. Build a list of **concrete** `Action` values: always `move` and one `turn_left` with a random step count; append **splat** / **dash** / **shoot_paintball** only when the matching `*_cooldown` on `player` is zero.
3. `random.choice` picks one of those actions (`dash` uses a random distance in `2`–`6`).

**Takeaways:** Cooldown fields on `game_state.me`; `Actions.turn_left`/`turn_right` take a step count; `Actions.dash` needs an integer distance (`2`–`6`).

## Greedy: step onto an unpainted tile

Prefer any neighbor that is still neutral (`controller` is `None`); otherwise keep moving forward.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection, HexUtils


class Bot:
    def decide(self, game_state):
        player = game_state.me
        hex_utils = HexUtils(game_state)

        # Each grid entry is a Hex (q, r, controller). Map coordinates to that instance
        # so .get(neighbor_hex) finds the tile with current paint state.
        hex_to_tile = {grid_hex: grid_hex for grid_hex in game_state.grid}

        # Check all six neighbors in fixed HexDirection order.
        for direction in HexDirection:
            neighbor_position = hex_utils.hex_neighbor(player.position, direction)
            neighbor_tile = hex_to_tile.get(neighbor_position)
            if neighbor_tile is None:
                continue
            if neighbor_tile.controller is None:
                # Unpainted neighbor: face that way if needed, then step onto it.
                if player.facing != direction:
                    return Actions.face_direction(direction)
                return Actions.move()

        # No unpainted neighbor found: keep moving forward in the current facing.
        return Actions.move()
```

**How it works**

1. Build a quick lookup from position to grid tile (since `Hex` equality is position-only, `hex_utils.hex_neighbor` results match grid tiles).
2. Loop the six directions in `HexDirection` order.
3. Skip neighbors that are off the map.
4. If a neighbor is unpainted (`controller is None`), **face** that way if needed, then **move** forward.
5. If none are unpainted, **move** forward in the current facing direction.

**Takeaways:** `hex.controller`, iterating directions, facing before `move()`, and a simple priority rule.

---
