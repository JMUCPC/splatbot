# Example Bots

Full scripts below, then a short **how it works** list. Assumes you have read [Writing bots](../writing-bots/) and skimmed [Actions](../actions/).

## Ping-pong (forward until a wall)

Same idea as on the writing-bots page, with a bit more narration.

```python
from utils.actions import Actions
from utils.hex_grid import HexUtils


class Bot:
    def decide(self, game_state):
        me = game_state.me
        hx = HexUtils(game_state)
        forward = hx.hex_neighbor(me.position, me.facing)
        if forward not in game_state.grid:
            return Actions.turn_180()
        return Actions.move()
```

**How it works**

1. Look up this bot's position and facing: `game_state.me.position`, `game_state.me.facing`.
2. Build `HexUtils(game_state)` and compute the hex straight ahead using `hx.hex_neighbor(position, facing)`.
3. If that hex is **not** on the map (`not in game_state.grid`), **turn 180°**; otherwise **move** forward.

**Takeaways:** `HexUtils`, `game_state.grid`, `Actions.turn_180()`, and moving relative to `facing` (works for both players).

## Splat when ready, otherwise move

Uses stun and cooldown checks from `game_state.me` before calling special actions.

```python
from utils.actions import Actions


class Bot:
    def decide(self, game_state):
        if game_state.me.stun > 0:
            return Actions.skip()
        if game_state.me.splat_cooldown == 0:
            return Actions.splat()
        return Actions.move()
```

**How it works**

1. While stunned, the only safe choice is usually `skip` (you cannot splat, move, or turn; here we skip whenever `me.stun > 0`).
2. When splat is off cooldown, splat to paint neighbors.
3. Otherwise move forward in the current facing direction.

**Takeaways:** Order matters — check stun before spending cooldowns. Tune the `else` branch for your strategy.

## Greedy: step onto an unpainted tile

Prefer any neighbor that is still neutral (`controller` is `None`); otherwise keep moving forward.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection, HexUtils


class Bot:
    def decide(self, game_state):
        me = game_state.me
        hx = HexUtils(game_state)
        grid_by_pos = {hex: hex for hex in game_state.grid}
        for d in HexDirection:
            nbr = hx.hex_neighbor(me.position, d)
            tile = grid_by_pos.get(nbr)
            if tile is None:
                continue
            if tile.controller is None:
                if me.facing != d:
                    return Actions.face_direction(d)
                return Actions.move()
        return Actions.move()
```

**How it works**

1. Build a quick lookup from position to grid tile (since `Hex` equality is position-only, `hx.hex_neighbor` results match grid tiles).
2. Loop the six directions in `HexDirection` order.
3. Skip neighbors that are off the map.
4. If a neighbor is unpainted (`controller is None`), **face** that way if needed, then **move** forward.
5. If none are unpainted, **move** forward in the current facing direction.

**Takeaways:** `hex.controller`, iterating directions, facing before `move()`, and a simple priority rule.

---
