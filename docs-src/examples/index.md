# Example Bots

Full scripts below, then a short **how it works** list. Assumes you have read [Writing bots](../writing-bots/) and skimmed [Actions](../actions/).

## Ping-pong (east / west)

Same idea as on the writing-bots page, with a bit more narration.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    def __init__(self):
        self._going_east = True

    def decide(self, game_state):
        me = game_state.me
        d = HexDirection.E if self._going_east else HexDirection.W
        nbr = hex_neighbor(me.position, d)
        if nbr not in game_state.grid:
            self._going_east = not self._going_east
            d = HexDirection.E if self._going_east else HexDirection.W
        if me.facing != d:
            return Actions.face_direction(d)
        return Actions.move()
```

**How it works**

1. Remember a boolean `_going_east` on `self` so the choice survives after `decide` returns.
2. Look up this bot's position: `game_state.me.position`.
3. Pick east or west from that boolean; compute the neighbor hex in that direction.
4. If that neighbor is **not** on the map (`not in game_state.grid`), flip direction and recompute the desired heading.
5. **Face** that direction if needed, otherwise **move** forward.

**Takeaways:** `hex_neighbor`, `game_state.grid`, facing + `move()`, and stored state on `self`.

## Splat when ready, otherwise move

Uses stun and cooldown checks from `game_state.me` before calling special actions.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection


class Bot:
    def decide(self, game_state):
        if game_state.me.stun > 0:
            return Actions.skip()
        if game_state.me.splat_cooldown == 0:
            return Actions.splat()
        me = game_state.me
        if me.facing != HexDirection.E:
            return Actions.face_direction(HexDirection.E)
        return Actions.move()
```

**How it works**

1. While stunned, the only safe choice is usually `skip` (you cannot splat, move, or turn; here we skip whenever `me.stun > 0`).
2. When splat is off cooldown, splat to paint neighbors.
3. Otherwise align to east if needed, then move forward.

**Takeaways:** Order matters — check stun before spending cooldowns. Tune the `else` branch for your strategy.

## Greedy: step onto an unpainted tile

Prefer any neighbor that is still neutral (`controller` is `None`); otherwise fall back to moving east.

```python
from utils.actions import Actions
from utils.hex_grid import HexDirection, hex_neighbor


class Bot:
    def decide(self, game_state):
        me = game_state.me
        grid_by_pos = {hex: hex for hex in game_state.grid}
        for d in HexDirection:
            nbr = hex_neighbor(me.position, d)
            tile = grid_by_pos.get(nbr)
            if tile is None:
                continue
            if tile.controller is None:
                if me.facing != d:
                    return Actions.face_direction(d)
                return Actions.move()
        if me.facing != HexDirection.E:
            return Actions.face_direction(HexDirection.E)
        return Actions.move()
```

**How it works**

1. Build a quick lookup from position to grid tile (since `Hex` equality is position-only, `hex_neighbor` results match grid tiles).
2. Loop the six directions in `HexDirection` order.
3. Skip neighbors that are off the map.
4. If a neighbor is unpainted (`controller is None`), **face** that way if needed, then **move** forward.
5. If none are unpainted, **face** east if needed, then **move** forward.

**Takeaways:** `hex.controller`, iterating directions, facing before `move()`, and a simple priority rule.

---
